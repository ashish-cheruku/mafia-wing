"""
FastAPI server: start game sessions + stream SSE events to browser.
"""
import asyncio
import json
import os
import threading
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import db
import game_registry
from game_registry import create_session, get_session
from web_orchestrator import WebGameOrchestrator
from llm_interface import LLMInterface


# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("gamelog-json", exist_ok=True)
    try:
        await asyncio.to_thread(db.init_db)
    except Exception as exc:
        print(f"[WARN] DB init failed (continuing without DB): {exc}")
    yield


app = FastAPI(title="Mafia Game API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000",
                   "http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class StartRequest(BaseModel):
    api_key: str = ""          # optional if OPENAI_API_KEY is set in environment
    model_name: str = "gpt-4o-mini"
    num_mafia: int = 2
    max_discussion_rounds: int = 2
    session_id: str = ""       # groups parallel games into a session


class StartResponse(BaseModel):
    game_id: str
    stream_url: str


# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------

def _write_json_log(game_id: str, events_log: list, model_name: str, num_mafia: int):
    try:
        winner = None
        elimination_order = []
        player_data = []
        rounds_played = 0

        for ev in events_log:
            rn = ev.get("round_number", 0)
            if rn and rn > rounds_played:
                rounds_played = rn
            if ev.get("type") == "game_over":
                winner = ev.get("winner")
                elimination_order = ev.get("elimination_order", [])
                player_data = ev.get("final_player_states", [])

        log_data = {
            "game_id": game_id,
            "model": model_name,
            "num_mafia": num_mafia,
            "winner": winner,
            "rounds_played": rounds_played,
            "elimination_order": elimination_order,
            "player_data": player_data,
            "events": events_log,
        }

        path = f"gamelog-json/{game_id}.json"
        with open(path, "w") as f:
            json.dump(log_data, f, indent=2)
    except Exception as exc:
        print(f"[WARN] Could not write JSON log for {game_id}: {exc}")


def _save_to_db(game_id: str, events_log: list, model_name: str, num_mafia: int,
                session_id: str = ""):
    try:
        winner = None
        elimination_order = []
        player_data = []
        rounds_played = 0
        num_players = 8

        for ev in events_log:
            rn = ev.get("round_number", 0)
            if rn and rn > rounds_played:
                rounds_played = rn
            if ev.get("type") == "game_init":
                num_players = len(ev.get("players", []))
            if ev.get("type") == "game_over":
                winner = ev.get("winner")
                elimination_order = ev.get("elimination_order", [])
                player_data = ev.get("final_player_states", [])

        log_file_path = f"gamelog-json/{game_id}.json"
        db.save_game(
            game_id, model_name, num_mafia, num_players, winner,
            rounds_played, elimination_order, player_data, log_file_path,
            session_id=session_id or None,
        )
    except Exception as exc:
        print(f"[WARN] Could not save to DB for {game_id}: {exc}")


# ---------------------------------------------------------------------------
# Background thread runner
# ---------------------------------------------------------------------------

def _run_game(game_id: str, api_key: str, model_name: str,
              num_mafia: int, max_discussion_rounds: int, session_id: str = ""):
    session = get_session(game_id)
    if session is None:
        return

    events_log: list = []

    def emit(event: dict):
        event.setdefault("game_id", game_id)
        events_log.append(event)
        session.event_queue.put(event)

    try:
        session.status = "running"
        llm = LLMInterface(api_key=api_key, model_name=model_name)
        orchestrator = WebGameOrchestrator(
            event_callback=emit,
            llm_interface=llm,
            max_discussion_rounds=max_discussion_rounds,
            max_mafia_iterations=3,
            num_mafia=num_mafia,
            observer_only=True,
        )
        orchestrator.initialize_game()
        orchestrator.play_game()
        session.status = "finished"
    except Exception as exc:
        session.status = "error"
        session.error = str(exc)
        emit({"type": "error", "message": str(exc)})
    finally:
        _write_json_log(game_id, events_log, model_name, num_mafia)
        _save_to_db(game_id, events_log, model_name, num_mafia, session_id=session_id)
        # Sentinel so SSE generator knows to close
        session.event_queue.put(None)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/config")
async def get_config():
    return {"api_key_configured": bool(os.environ.get("OPENAI_API_KEY"))}


@app.post("/api/start", response_model=StartResponse)
async def start_game(req: StartRequest):
    resolved_key = os.environ.get("OPENAI_API_KEY") or req.api_key
    if not resolved_key:
        raise HTTPException(status_code=400, detail="OpenAI API key required — set OPENAI_API_KEY env var or provide it in the request")

    game_id = str(uuid.uuid4())
    session = create_session(game_id)

    t = threading.Thread(
        target=_run_game,
        args=(game_id, resolved_key, req.model_name,
              req.num_mafia, req.max_discussion_rounds, req.session_id),
        daemon=True,
    )
    session.thread = t
    t.start()

    return StartResponse(
        game_id=game_id,
        stream_url=f"/api/stream/{game_id}",
    )


@app.get("/api/stream/{game_id}")
async def stream_events(game_id: str):
    session = get_session(game_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Game not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        while True:
            try:
                event = await asyncio.to_thread(
                    session.event_queue.get, True, 30.0  # block=True, timeout=30s
                )
            except Exception:
                # Timeout — send keepalive comment
                yield ": keepalive\n\n"
                continue

            if event is None:
                # Sentinel: game finished
                yield "event: done\ndata: {}\n\n"
                break

            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/status/{game_id}")
async def game_status(game_id: str):
    session = get_session(game_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Game not found")
    return {"game_id": game_id, "status": session.status, "error": session.error}


@app.get("/api/metrics")
async def get_metrics():
    try:
        return await asyncio.to_thread(db.get_metrics)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"DB unavailable: {exc}")


@app.get("/api/metrics/games")
async def list_games(limit: int = 20):
    try:
        return await asyncio.to_thread(db.list_games, limit)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"DB unavailable: {exc}")


@app.get("/api/sessions")
async def list_sessions(limit: int = 50):
    try:
        return await asyncio.to_thread(db.list_sessions, limit)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"DB unavailable: {exc}")


@app.get("/api/sessions/{session_id}")
async def get_session_games(session_id: str):
    try:
        games = await asyncio.to_thread(db.get_session_games, session_id)
        if not games:
            raise HTTPException(status_code=404, detail="Session not found")
        return games
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"DB unavailable: {exc}")


@app.get("/api/games/{game_id}")
async def get_game_log(game_id: str):
    path = f"gamelog-json/{game_id}.json"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Game log not found")
    try:
        with open(path) as f:
            return json.load(f)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read log: {exc}")


@app.get("/health")
async def health():
    return {"ok": True}
