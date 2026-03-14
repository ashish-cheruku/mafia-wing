# Mafia Wing

A real-time multiplayer Mafia game powered by 8 AI agents, each with a distinct personality. Watch the agents discuss, deceive, vote, and eliminate each other — streamed live to a web UI. Run up to 10 games simultaneously in parallel tabs.

---

## Overview

Mafia Wing runs a complete game of Mafia autonomously. Eight AI personalities are assigned roles (Mafia, Doctor, Detective, Villager) at random each game. The game engine drives night phases, day discussions, voting, trials, and defenses. Every action is streamed in real time to a Next.js frontend via Server-Sent Events.

No human input is required — start a game and watch it play out.

---

## Players

| Player | Personality |
|---|---|
| Revant | Paranoid and suspicious — questions everyone, changes suspects frequently |
| Thisya | Charming and smooth — deflects with compliments, hard to pin down |
| Baashish | Logical and methodical — tracks patterns, calls out contradictions |
| Gauranga | Emotional and intuitive — acts on gut feeling, struggles to explain reasoning |
| Gian Reddy | Quiet and observant — rarely speaks, but insightful when he does |
| Harryshit | Impulsive and chaotic — random accusations, loves stirring the pot |
| Cheruku | Blunt and direct — no patience for games, says exactly what he thinks |
| Remo Sai | Strategic and calculating — gathers intel quietly, acts at the right moment |

---

## Roles

| Role | Count | Ability |
|---|---|---|
| Mafia | 2 | Know each other. Each night, coordinate to eliminate a player |
| Doctor | 1 | Each night, save one player from elimination |
| Detective | 1 | Each night, investigate a player to learn their role |
| Villager | 4 | Use discussion and voting to identify and eliminate Mafia |

**Win conditions**
- Village wins when both Mafia members are eliminated
- Mafia wins when they equal or outnumber the remaining village
- Tie in edge cases (e.g. Doctor vs. Mafia in final 2)

---

## Architecture

```
mafia-wing/
├── Backend (Python)
│   ├── main.py                   # CLI entry point
│   ├── game_orchestrator.py      # Core game engine — phases, flow, win conditions
│   ├── web_orchestrator.py       # Subclass that emits SSE events; round-robin discussion
│   ├── game_state.py             # GameState, Player, Role, GamePhase, GameAction
│   ├── base_agent.py             # Abstract agent base class
│   ├── role_agents.py            # MafiaAgent, DoctorAgent, DetectiveAgent, VillagerAgent
│   ├── llm_interface.py          # OpenAI API wrapper
│   ├── structured_responses.py   # Pydantic response schemas
│   ├── agent_personalities.py    # Player names, personalities, role distribution
│   ├── game_registry.py          # In-memory session store (game_id → queue + thread)
│   ├── db.py                     # PostgreSQL client (Neon) — metrics + game history
│   ├── server.py                 # FastAPI server — /api/start, /api/stream, /api/metrics
│   ├── requirements.txt          # CLI dependencies
│   ├── requirements_web.txt      # Web server dependencies
│   ├── .env                      # Backend environment variables (not committed)
│   └── gamelog-json/             # Auto-generated per-game JSON transcripts
│
└── web/                          # Next.js frontend
    ├── app/
    │   ├── page.tsx              # Setup screen (API key + number of games)
    │   ├── game/[gameId]/        # Single game live view
    │   └── games/                # Multi-game tabbed view (/games?ids=id1,id2,...)
    ├── components/
    │   ├── SetupScreen.tsx       # Config UI — auto-detects server API key
    │   ├── GameView.tsx          # Reusable game view (used by both single + multi)
    │   ├── PhaseHeader.tsx       # Round + phase indicator
    │   ├── PlayerGrid.tsx        # 8-player grid with roles
    │   ├── PlayerCard.tsx        # Individual player card
    │   ├── RoundTabs.tsx         # Per-round Night / Day Discussion tabs
    │   ├── VotingPanel.tsx       # Live vote tally + trial + defense
    │   └── GameOverScreen.tsx    # Result, role reveal, conversation history, PDF export
    ├── hooks/
    │   ├── useGameState.ts       # Reducer — processes SSE events into UI state
    │   └── useGameSSE.ts         # SSE connection hook
    └── lib/
        └── types.ts              # Shared TypeScript types
```

### SSE Streaming Bridge

The game runs in a background `threading.Thread`. As the engine calls `_observer_info()`, `WebGameOrchestrator` classifies each message into a typed event and puts it on a `queue.Queue`. The FastAPI SSE endpoint reads from the queue via `asyncio.to_thread` and streams events to the browser. A `None` sentinel signals game over.

```
Game Thread  →  queue.Queue  →  asyncio.to_thread  →  SSE  →  Browser
```

Each game additionally logs every event to `gamelog-json/{game_id}.json` and persists metrics to a Neon PostgreSQL database after the game ends.

---

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 18+
- OpenAI API key

### 1. Clone

```bash
git clone https://github.com/ashish-cheruku/mafia-wing.git
cd mafia-wing
```

### 2. Backend environment

Create `.env` in the project root:

```env
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:pass@host/db
```

`OPENAI_API_KEY` can alternatively be entered in the browser UI — no `.env` needed if you prefer that.
`DATABASE_URL` is required only for metrics persistence. The game runs fine without it (a warning is logged and the metrics endpoints return 503).

### 3. Backend

```bash
pip install -r requirements_web.txt
set -a && source .env && set +a   # load env vars
uvicorn server:app --reload
# Runs on http://localhost:8000
```

### 4. Frontend

```bash
cd web
npm install
npm run dev
# Runs on http://localhost:3000
```

No frontend `.env` changes needed — the browser detects the server-configured API key automatically via `GET /api/config`.

---

## Environment Variables

### Backend (`mafia/.env`)

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Optional* | OpenAI API key used by the game engine. If set, the UI skips the key input. |
| `DATABASE_URL` | Optional | PostgreSQL connection string. Enables metrics persistence and `/api/metrics` endpoints. |

*If not set in env, the key must be entered in the browser UI before starting a game.

### Frontend (`web/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_OPENAI_API_KEY` | Pre-fills the API key input in the UI (optional — server env is preferred). |
| `NEXT_PUBLIC_BACKEND_URL` | Override backend URL (default: `http://localhost:8000`). |

---

## Running via CLI (no web UI)

```bash
pip install -r requirements.txt
python main.py
```

Edit `main.py` to change model, number of mafia, or discussion rounds.

---

## Web UI Features

**Setup screen**
- Enter your OpenAI API key (or skip if configured server-side)
- Set number of parallel games (1–10)

**Live game view**
- Left sidebar: player grid showing all 8 players with role badges, vote counts, trial indicator
- Center panel: tabbed per-round view with Night and Day Discussion sub-tabs — scrollable, auto-follows the active round
- Right panel: live vote tally, trial banner, defense speech

**Multi-game view** (`/games?ids=...`)
- Tab bar with per-game status indicators: `●` running, `✓` village wins, `✗` mafia wins, `─` tie
- All game tabs stay mounted (SSE connections remain open) — only CSS-toggled between active/hidden
- `← Back` button returns to setup

**Game over screen**
- Overview tab: result banner, full role reveal, elimination order
- Conversation History tab: every round's night events and day discussion, with role badges revealed
- Download PDF: exports the full transcript as a clean document

**Metrics API**
- `GET /api/metrics` — aggregated win rates and average rounds
- `GET /api/metrics/games?limit=20` — last N games from the database

**JSON logs**
- Every completed game is written to `gamelog-json/{game_id}.json` with full event log, winner, elimination order, and player states

---

## Game Flow

```
START
  └── Night Phase
        ├── Mafia: discuss and reach consensus on elimination target
        ├── Doctor: choose a player to save
        └── Detective: investigate a player → learn their role
  └── Day Phase
        ├── Discussion: every alive player speaks (round-robin, random order)
        └── Voting
              ├── Each player votes with reasoning
              ├── Highest-voted player goes to trial
              ├── Suspect gives defense speech
              ├── Final vote after defense
              └── Elimination (or tie → no elimination)
  └── Win check → repeat or end
```

---

## API Reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/start` | Start a new game. Body: `{ api_key?, model_name?, num_mafia?, max_discussion_rounds? }` |
| `GET` | `/api/stream/{game_id}` | SSE stream of game events |
| `GET` | `/api/status/{game_id}` | Game status (`idle` / `running` / `finished` / `error`) |
| `GET` | `/api/config` | Returns `{ api_key_configured: bool }` |
| `GET` | `/api/metrics` | Aggregated stats (total games, win rates, avg rounds) |
| `GET` | `/api/metrics/games` | Last N games from DB (`?limit=20`) |
| `GET` | `/health` | Health check |

---

## Configuration

### Changing the model

Default is `gpt-4o-mini`. Pass `model_name` in the POST body to override:

```json
{ "model_name": "gpt-4o" }
```

### Adding a player

1. Add an entry to `AGENT_PERSONALITIES` in `agent_personalities.py`
2. Update `ROLE_DISTRIBUTION` to match the new player count
3. Update the player list in `web/components/SetupScreen.tsx`

### Changing role counts

Update `num_mafia` in the POST request body (default: 2). The engine calculates villager count automatically: `total_players - num_mafia - 2` (doctor + detective).

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI agents | OpenAI API (`gpt-4o-mini` default) |
| Game engine | Python 3, threading, queue |
| API server | FastAPI, uvicorn |
| Streaming | Server-Sent Events (SSE) |
| Database | Neon (PostgreSQL), psycopg2 |
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS, shadcn/ui, Inter font |
| PDF export | jsPDF |

---

## Project Structure Notes

- `WebGameOrchestrator` in `web_orchestrator.py` overrides two methods from `GameOrchestrator`: `_observer_info` (to emit SSE events) and `_run_discussion_phase` (to enforce round-robin participation). No core game files are modified.
- `game_registry.py` is a simple in-memory dict mapping `game_id → GameSession`. Each session holds a queue, a thread reference, status, and error state.
- Role assignment is fully random each game — both the player order and role list are independently shuffled.
- `db.py` reads `DATABASE_URL` from the environment. If unset, all DB calls raise a `RuntimeError` which is caught and logged — the game continues without persistence.
