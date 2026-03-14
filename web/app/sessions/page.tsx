"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SessionRow {
  session_id: string;
  created_at: string;
  num_games: number;
  game_ids: string[];
  village_wins: number;
  mafia_wins: number;
  other_wins: number;
  model: string | null;
  num_mafia: number | null;
  num_players: number | null;
}

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

function WinBar({ village, mafia, other, total }: {
  village: number; mafia: number; other: number; total: number;
}) {
  if (total === 0) return <span className="text-neutral-600 text-xs">—</span>;
  const vPct = (village / total) * 100;
  const mPct = (mafia / total) * 100;
  const oPct = (other / total) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-1.5 rounded-full overflow-hidden w-20 bg-neutral-800">
        {vPct > 0 && <div style={{ width: `${vPct}%` }} className="bg-emerald-500" />}
        {mPct > 0 && <div style={{ width: `${mPct}%` }} className="bg-rose-500" />}
        {oPct > 0 && <div style={{ width: `${oPct}%` }} className="bg-neutral-500" />}
      </div>
      <span className="text-neutral-400 text-xs whitespace-nowrap">
        {village > 0 && <span className="text-emerald-400">{village}V</span>}
        {village > 0 && mafia > 0 && <span className="text-neutral-600"> / </span>}
        {mafia > 0 && <span className="text-rose-400">{mafia}M</span>}
        {other > 0 && <span className="text-neutral-500"> / {other}T</span>}
      </span>
    </div>
  );
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
    fetch(`${BACKEND}/api/sessions?limit=100`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json();
      })
      .then((data) => { setSessions(data); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  const totalGames = sessions.reduce((s, r) => s + (r.num_games ?? 1), 0);

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
          <span className="text-neutral-600 text-xs">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} · {totalGames} game{totalGames !== 1 ? "s" : ""}
          </span>
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

        {!loading && !error && sessions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-2">
            <p className="text-neutral-500 text-sm">No sessions recorded yet.</p>
            <p className="text-neutral-700 text-xs">Games are saved after they finish.</p>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <div className="border border-neutral-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80">
                  <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">#</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">Date</th>
                  <th className="text-center px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">Games</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">Results</th>
                  <th className="text-center px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">Players</th>
                  <th className="text-center px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">Mafia</th>
                  <th className="text-left px-4 py-3 text-neutral-500 font-medium text-xs uppercase tracking-widest">Model</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, i) => (
                  <tr
                    key={s.session_id}
                    className={`border-b border-neutral-800/40 hover:bg-neutral-900/40 transition-colors cursor-pointer ${
                      i % 2 === 0 ? "bg-neutral-950" : "bg-neutral-900/20"
                    }`}
                    onClick={() => router.push(`/sessions/${s.session_id}`)}
                  >
                    <td className="px-4 py-3 text-neutral-600 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 text-neutral-400 text-xs whitespace-nowrap">
                      {s.created_at ? formatDate(s.created_at) : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-center text-xs">
                      {s.num_games ?? 1}
                    </td>
                    <td className="px-4 py-3">
                      <WinBar
                        village={s.village_wins ?? 0}
                        mafia={s.mafia_wins ?? 0}
                        other={s.other_wins ?? 0}
                        total={s.num_games ?? 1}
                      />
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-center text-xs">
                      {s.num_players ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-center text-xs">
                      {s.num_mafia ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 text-xs font-mono">
                      {s.model ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-neutral-600 text-xs hover:text-neutral-300 transition-colors">
                        View →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
