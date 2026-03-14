"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { GameOverScreen } from "@/components/GameOverScreen";
import { ChatEntry, PlayerFinalState, SSEEvent } from "@/lib/types";

interface GameLog {
  game_id: string;
  model: string;
  winner: string;
  rounds_played: number;
  elimination_order: string[];
  player_data: PlayerFinalState[];
  events: SSEEvent[];
}

interface ReconstructedState {
  winner: string;
  finalPlayerStates: PlayerFinalState[];
  eliminationOrder: string[];
  rounds: number[];
  chatByRound: Record<number, ChatEntry[]>;
  nightLogByRound: Record<number, string[]>;
  eliminationByRound: Record<number, string[]>;
}

function reconstructFromEvents(log: GameLog): ReconstructedState {
  let roundNumber = 1;
  const rounds: number[] = [];
  const chatByRound: Record<number, ChatEntry[]> = {};
  const nightLogByRound: Record<number, string[]> = {};
  const eliminationByRound: Record<number, string[]> = {};
  const eliminationOrder: string[] = [];

  function addRound(rn: number) {
    if (!rounds.includes(rn)) rounds.push(rn);
  }

  for (const ev of log.events) {
    switch (ev.type) {
      case "phase_change": {
        const rn = ev.round_number ?? roundNumber;
        roundNumber = rn;
        addRound(rn);
        if (ev.phase === "night") {
          if (!nightLogByRound[rn]) nightLogByRound[rn] = [];
        }
        if (ev.phase === "day") {
          if (!chatByRound[rn]) chatByRound[rn] = [];
        }
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

  // Use log-level data as ground truth for winner/players/order
  return {
    winner: log.winner ?? "tie",
    finalPlayerStates: log.player_data ?? [],
    eliminationOrder: log.elimination_order ?? eliminationOrder,
    rounds,
    chatByRound,
    nightLogByRound,
    eliminationByRound,
  };
}

export default function SessionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const gameId = params.gameId as string;

  const [state, setState] = useState<ReconstructedState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
    fetch(`${BACKEND}/api/games/${gameId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.json() as Promise<GameLog>;
      })
      .then((log) => {
        setState(reconstructFromEvents(log));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [gameId]);

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-white">
      {/* Back bar */}
      <div className="border-b border-neutral-800 px-6 h-10 flex items-center gap-3 shrink-0">
        <button
          onClick={() => router.push("/sessions")}
          className="text-neutral-500 text-sm hover:text-white transition-colors"
        >
          ← Sessions
        </button>
        <span className="w-px h-4 bg-neutral-800" />
        <span className="text-neutral-600 text-xs font-mono truncate">{gameId}</span>
      </div>

      <div className="flex-1 min-h-0">
        {loading && (
          <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
            Loading session…
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full text-rose-400 text-sm">
            Failed to load: {error}
          </div>
        )}

        {state && (
          <GameOverScreen
            winner={state.winner}
            finalPlayerStates={state.finalPlayerStates}
            eliminationOrder={state.eliminationOrder}
            rounds={state.rounds}
            chatByRound={state.chatByRound}
            nightLogByRound={state.nightLogByRound}
            eliminationByRound={state.eliminationByRound}
          />
        )}
      </div>
    </div>
  );
}
