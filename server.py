"""
FastAPI server: start game sessions + stream SSE events to browser.
"""
import asyncio
import json
import threading
import uuid
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import game_registry
from game_registry import create_session, get_session
from web_orchestrator import WebGameOrchestrator
from llm_interface import LLMInterface

app = FastAPI(title="Mafia Game API")

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
    api_key: str
    model_name: str = "gpt-4o-mini"
    num_mafia: int = 2
    max_discussion_rounds: int = 2


class StartResponse(BaseModel):
    game_id: str
    stream_url: str


# ---------------------------------------------------------------------------
# Background thread runner
# ---------------------------------------------------------------------------

def _run_game(game_id: str, api_key: str, model_name: str,
              num_mafia: int, max_discussion_rounds: int):
    session = get_session(game_id)
    if session is None:
        return

    def emit(event: dict):
        event.setdefault("game_id", game_id)
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
        # Sentinel so SSE generator knows to close
        session.event_queue.put(None)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/start", response_model=StartResponse)
async def start_game(req: StartRequest):
    game_id = str(uuid.uuid4())
    session = create_session(game_id)

    t = threading.Thread(
        target=_run_game,
        args=(game_id, req.api_key, req.model_name,
              req.num_mafia, req.max_discussion_rounds),
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


@app.get("/health")
async def health():
    return {"ok": True}
