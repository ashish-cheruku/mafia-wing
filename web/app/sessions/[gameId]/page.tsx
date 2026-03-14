"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { GameOverScreen } from "@/components/GameOverScreen";
import { MetricsView } from "@/components/MetricsView";
import { ChatEntry, PlayerFinalState, SSEEvent, GameSummary } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GameLog {
  game_id: string;
  model: string;
  winner: string;
  rounds_played: number;
  elimination_order: string[];
  player_data: PlayerFinalState[];
  events: SSEEvent[];
}

interface ReconstructedGame {
  gameId: string;
  winner: string;
  finalPlayerStates: PlayerFinalState[];
  eliminationOrder: string[];
  rounds: number[];
  chatByRound: Record<number, ChatEntry[]>;
  nightLogByRound: Record<number, string[]>;
  eliminationByRound: Record<number, string[]>;
}

// ---------------------------------------------------------------------------
// Reconstruct display state from raw events
// ---------------------------------------------------------------------------

function reconstructFromLog(log: GameLog): ReconstructedGame {
  let roundNumber = 1;
  const rounds: number[] = [];
  const chatByRound: Record<number, ChatEntry[]> = {};
  const nightLogByRound: Record<number, string[]> = {};
  const eliminationByRound: Record<number, string[]> = {};
  const eliminationOrder: string[] = [];

  for (const ev of log.events) {
    switch (ev.type) {
      case "phase_change": {
        const rn = ev.round_number ?? roundNumber;
        roundNumber = rn;
        if (!rounds.includes(rn)) rounds.push(rn);
        if (ev.phase === "night" && !nightLogByRound[rn]) nightLogByRound[rn] = [];
        if (ev.phase === "day" && !chatByRound[rn]) chatByRound[rn] = [];
        break;
      }
      case "night_action": {
        const rn = ev.round_number ?? roundNumber;
        const entry = ev.message ?? `${ev.actor_role}: ${ev.target ?? ""}`;
        if (!nightLogByRound[rn]) nightLogByRound[rn] = [];
        nightLogByRound[rn].push(entry);
        break;
      }
      case "night_resolved": {
        const rn = ev.round_number ?? roundNumber;
        if (!nightLogByRound[rn]) nightLogByRound[rn] = [];
        if (ev.eliminated) nightLogByRound[rn].push(`${ev.eliminated} was eliminated`);
        else if (ev.saved) nightLogByRound[rn].push(`${ev.saved} was saved — no one died`);
        break;
      }
      case "chat_message": {
        const rn = ev.round_number ?? roundNumber;
        if (!chatByRound[rn]) chatByRound[rn] = [];
        chatByRound[rn].push({ player_name: ev.player_name, message: ev.message, round_number: rn });
        break;
      }
      case "elimination": {
        const rn = ev.round_number ?? roundNumber;
        eliminationOrder.push(ev.player_name);
        if (!eliminationByRound[rn]) eliminationByRound[rn] = [];
        eliminationByRound[rn].push(ev.player_name);
        break;
      }
    }
  }

  return {
    gameId: log.game_id,
    winner: log.winner ?? "tie",
    finalPlayerStates: log.player_data ?? [],
    eliminationOrder: log.elimination_order ?? eliminationOrder,
    rounds,
    chatByRound,
    nightLogByRound,
    eliminationByRound,
  };
}

// ---------------------------------------------------------------------------
// Tab indicator
// ---------------------------------------------------------------------------

function TabIndicator({ winner }: { winner: string | null }) {
  if (winner === "mafia") return <span className="text-rose-400 font-bold">✗</span>;
  if (winner === "village") return <span className="text-emerald-400 font-bold">✓</span>;
  if (winner) return <span className="text-neutral-400">─</span>;
  return <span className="inline-block w-2 h-2 rounded-full bg-neutral-500" />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.gameId as string;

  const [games, setGames] = useState<ReconstructedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<number | "metrics">(0);

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

  useEffect(() => {
    // 1. Get game IDs for this session
    fetch(`${BACKEND}/api/sessions/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Session not found (${r.status})`);
        return r.json() as Promise<{ game_id: string }[]>;
      })
      .then(async (rows) => {
        // 2. Fetch each game's full log in parallel
        const logs = await Promise.all(
          rows.map((row) =>
            fetch(`${BACKEND}/api/games/${row.game_id}`).then((r) => {
              if (!r.ok) throw new Error(`Game log missing for ${row.game_id}`);
              return r.json() as Promise<GameLog>;
            })
          )
        );
        setGames(logs.map(reconstructFromLog));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [sessionId, BACKEND]);

  // Build GameSummary objects for MetricsView
  const summaries: GameSummary[] = games.map((g) => ({
    gameId: g.gameId,
    winner: g.winner,
    roundsPlayed: g.rounds.length > 0 ? Math.max(...g.rounds) : 0,
    rounds: g.rounds,
    finalPlayerStates: g.finalPlayerStates,
    eliminationOrder: g.eliminationOrder,
    eliminationByRound: g.eliminationByRound,
    chatByRound: g.chatByRound,
    nightLogByRound: g.nightLogByRound,
  }));

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-white">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 border-b border-neutral-800 shrink-0 h-10">
        <button
          onClick={() => router.push("/sessions")}
          className="text-neutral-500 text-xs hover:text-white px-2 py-1 rounded transition-colors mr-2"
        >
          ← Sessions
        </button>
        <div className="w-px h-4 bg-neutral-800 mr-2" />

        {loading && (
          <span className="text-neutral-600 text-xs">Loading…</span>
        )}

        {!loading && !error && games.map((g, i) => (
          <button
            key={g.gameId}
            onClick={() => setActiveTab(i)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === i
                ? "bg-neutral-800 text-white"
                : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900"
            }`}
          >
            <span>Game {i + 1}</span>
            <TabIndicator winner={g.winner} />
          </button>
        ))}

        {!loading && !error && games.length > 0 && (
          <>
            <div className="w-px h-4 bg-neutral-800 mx-1" />
            <button
              onClick={() => setActiveTab("metrics")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
                activeTab === "metrics"
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900"
              }`}
            >
              <span>Metrics</span>
              <span className="text-[10px] bg-neutral-700 text-neutral-300 px-1.5 py-0.5 rounded-full font-medium">
                {games.length}
              </span>
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-600 text-sm">
            Loading session…
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-rose-400 text-sm">
            {error}
          </div>
        )}

        {!loading && !error && games.map((g, i) => (
          <div
            key={g.gameId}
            style={{
              display: activeTab === i ? "flex" : "none",
              position: "absolute",
              inset: 0,
              flexDirection: "column",
            }}
          >
            <GameOverScreen
              winner={g.winner}
              finalPlayerStates={g.finalPlayerStates}
              eliminationOrder={g.eliminationOrder}
              rounds={g.rounds}
              chatByRound={g.chatByRound}
              nightLogByRound={g.nightLogByRound}
              eliminationByRound={g.eliminationByRound}
            />
          </div>
        ))}

        {!loading && !error && activeTab === "metrics" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <MetricsView summaries={summaries} totalGames={games.length} />
          </div>
        )}
      </div>
    </div>
  );
}
