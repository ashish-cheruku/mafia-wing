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
                    log_file_path TEXT
                );
            """)
        conn.commit()
        print("[INFO] DB initialized")
    finally:
        conn.close()


def save_game(game_id, model, num_mafia, num_players, winner,
              rounds_played, elimination_order, player_data, log_file_path):
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO games (game_id, model, num_mafia, num_players, winner,
                                   rounds_played, elimination_order, player_data, log_file_path)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (game_id) DO NOTHING;
            """, (
                game_id, model, num_mafia, num_players, winner,
                rounds_played,
                json.dumps(elimination_order),
                json.dumps(player_data),
                log_file_path,
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
