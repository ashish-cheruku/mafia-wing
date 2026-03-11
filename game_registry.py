"""In-memory store for active game sessions."""
import queue
import threading
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class GameSession:
    game_id: str
    event_queue: queue.Queue = field(default_factory=queue.Queue)
    thread: Optional[threading.Thread] = None
    status: str = "starting"  # starting | running | finished | error
    error: Optional[str] = None


_sessions: dict[str, GameSession] = {}
_lock = threading.Lock()


def create_session(game_id: str) -> GameSession:
    session = GameSession(game_id=game_id)
    with _lock:
        _sessions[game_id] = session
    return session


def get_session(game_id: str) -> Optional[GameSession]:
    with _lock:
        return _sessions.get(game_id)


def list_sessions() -> list[str]:
    with _lock:
        return list(_sessions.keys())
