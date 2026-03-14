"""PostgreSQL client for Neon database."""
import json
import os

import psycopg2


def _get_conn():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL environment variable is not set")
    return psycopg2.connect(url)


def init_db():
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS games (
                    id SERIAL PRIMARY KEY,
                    game_id TEXT UNIQUE NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    model TEXT,
                    num_mafia INT,
                    num_players INT,
                    winner TEXT,
                    rounds_played INT,
                    elimination_order JSONB,
                    player_data JSONB,
                    log_file_path TEXT,
                    session_id TEXT
                );
            """)
            # Add session_id to existing tables that don't have it
            cur.execute("""
                ALTER TABLE games ADD COLUMN IF NOT EXISTS session_id TEXT;
            """)
        conn.commit()
        print("[INFO] DB initialized")
    finally:
        conn.close()


def save_game(game_id, model, num_mafia, num_players, winner,
              rounds_played, elimination_order, player_data, log_file_path,
              session_id=None):
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO games (game_id, model, num_mafia, num_players, winner,
                                   rounds_played, elimination_order, player_data, log_file_path,
                                   session_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (game_id) DO NOTHING;
            """, (
                game_id, model, num_mafia, num_players, winner,
                rounds_played,
                json.dumps(elimination_order),
                json.dumps(player_data),
                log_file_path,
                session_id,
            ))
        conn.commit()
    except Exception as exc:
        print(f"[WARN] DB save_game failed: {exc}")
    finally:
        conn.close()


def get_metrics():
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COUNT(*) as total_games,
                    COUNT(*) FILTER (WHERE winner = 'mafia') as mafia_wins,
                    COUNT(*) FILTER (WHERE winner = 'village') as village_wins,
                    COUNT(*) FILTER (WHERE winner NOT IN ('mafia', 'village') AND winner IS NOT NULL) as other_wins,
                    ROUND(AVG(rounds_played)::numeric, 2) as avg_rounds
                FROM games;
            """)
            row = cur.fetchone()
        if row is None:
            return {"total_games": 0, "mafia_wins": 0, "village_wins": 0,
                    "other_wins": 0, "avg_rounds": 0.0, "mafia_win_rate": 0.0, "village_win_rate": 0.0}
        total, mafia_wins, village_wins, other_wins, avg_rounds = row
        total = total or 0
        mafia_wins = mafia_wins or 0
        village_wins = village_wins or 0
        other_wins = other_wins or 0
        return {
            "total_games": total,
            "mafia_wins": mafia_wins,
            "village_wins": village_wins,
            "other_wins": other_wins,
            "avg_rounds": float(avg_rounds) if avg_rounds else 0.0,
            "mafia_win_rate": round(mafia_wins / total, 3) if total else 0.0,
            "village_win_rate": round(village_wins / total, 3) if total else 0.0,
        }
    finally:
        conn.close()


def list_sessions(limit: int = 50):
    """Return one row per session (group of parallel games), newest first."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    COALESCE(session_id, game_id) AS session_id,
                    MIN(created_at) AS created_at,
                    COUNT(*) AS num_games,
                    array_agg(game_id ORDER BY created_at) AS game_ids,
                    COUNT(*) FILTER (WHERE winner = 'village') AS village_wins,
                    COUNT(*) FILTER (WHERE winner = 'mafia') AS mafia_wins,
                    COUNT(*) FILTER (WHERE winner NOT IN ('village','mafia') AND winner IS NOT NULL) AS other_wins,
                    MAX(model) AS model,
                    MAX(num_mafia) AS num_mafia,
                    MAX(num_players) AS num_players
                FROM games
                GROUP BY COALESCE(session_id, game_id)
                ORDER BY MIN(created_at) DESC
                LIMIT %s;
            """, (limit,))
            cols = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
        result = []
        for row in rows:
            d = dict(zip(cols, row))
            if d.get("created_at"):
                d["created_at"] = d["created_at"].isoformat()
            if d.get("game_ids") is None:
                d["game_ids"] = []
            result.append(d)
        return result
    finally:
        conn.close()


def get_session_games(session_id: str):
    """Return all game rows for a session_id (or single game if session_id==game_id)."""
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT game_id, created_at, model, num_mafia, num_players, winner, rounds_played
                FROM games
                WHERE COALESCE(session_id, game_id) = %s
                ORDER BY created_at ASC;
            """, (session_id,))
            cols = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
        result = []
        for row in rows:
            d = dict(zip(cols, row))
            if d.get("created_at"):
                d["created_at"] = d["created_at"].isoformat()
            result.append(d)
        return result
    finally:
        conn.close()


def list_games(limit: int = 20):
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT game_id, created_at, model, num_mafia, num_players, winner, rounds_played
                FROM games
                ORDER BY created_at DESC
                LIMIT %s;
            """, (limit,))
            cols = [desc[0] for desc in cur.description]
            rows = cur.fetchall()
        result = []
        for row in rows:
            d = dict(zip(cols, row))
            if d.get("created_at"):
                d["created_at"] = d["created_at"].isoformat()
            result.append(d)
        return result
    finally:
        conn.close()
