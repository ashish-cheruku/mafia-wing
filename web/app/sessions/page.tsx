"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface GameRow {
  game_id: string;
  created_at: string;
  model: string | null;
  num_mafia: number | null;
  num_players: number | null;
  winner: string | null;
  rounds_played: number | null;
}

const WINNER_STYLE: Record<string, { label: string; cls: string }> = {
  village: { label: "Village Wins", cls: "text-emerald-400" },
  mafia:   { label: "Mafia Wins",   cls: "text-rose-400"    },
  tie:     { label: "Tie",          cls: "text-neutral-400" },
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function SessionsPage() {
  const router = useRouter();
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
    fetch(`${BACKEND}/api/metrics/games?limit=100`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((data) => { setGames(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <div className="border-b border-neutral-800 px-6 h-12 flex items-center gap-4">
        <button
          onClick={() => router.push("/")}
          className="text-neutral-500 text-sm hover:text-white transition-colors"
        >
          ← Back
        </button>
        <span className="w-px h-4 bg-neutral-800" />
        <span className="text-white font-semibold text-sm tracking-tight">Previous Sessions</span>
        {!loading && !error && (
          <span className="text-neutral-600 text-xs">{games.length} game{games.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading && (
          <div className="flex items-center justify-center py-24 text-neutral-600 text-sm">
            Loading sessions…
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-24 text-rose-400 text-sm">
            Failed to load: {error}
          </div>
        )}

        {!loading && !error && games.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <p className="text-neutral-500 text-sm">No sessions recorded yet.</p>
            <p className="text-neutral-700 text-xs">Games are saved after they finish.</p>
          </div>
        )}

        {!loading && !error && games.length > 0 && (
          <div className="border border-neutral-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80">
                  <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">#</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">Date</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">Result</th>
                  <th className="text-center px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">Rounds</th>
                  <th className="text-center px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">Players</th>
                  <th className="text-center px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">Mafia</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">Model</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {games.map((g, i) => {
                  const cfg = g.winner ? (WINNER_STYLE[g.winner] ?? { label: g.winner, cls: "text-neutral-400" }) : null;
                  return (
                    <tr
                      key={g.game_id}
                      className={`border-b border-neutral-800/40 hover:bg-neutral-900/40 transition-colors cursor-pointer ${
                        i % 2 === 0 ? "bg-neutral-950" : "bg-neutral-900/20"
                      }`}
                      onClick={() => router.push(`/sessions/${g.game_id}`)}
                    >
                      <td className="px-4 py-3 text-neutral-600 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 text-neutral-400 text-xs whitespace-nowrap">
                        {g.created_at ? formatDate(g.created_at) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {cfg ? (
                          <span className={`font-semibold text-xs ${cfg.cls}`}>{cfg.label}</span>
                        ) : (
                          <span className="text-neutral-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-center text-xs">
                        {g.rounds_played ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-center text-xs">
                        {g.num_players ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-center text-xs">
                        {g.num_mafia ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600 text-xs font-mono">
                        {g.model ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-neutral-600 text-xs hover:text-neutral-300 transition-colors">
                          View →
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
