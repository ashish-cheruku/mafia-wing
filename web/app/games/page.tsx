"use client";

import { Suspense, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { GameView } from "@/components/GameView";
import { MetricsView } from "@/components/MetricsView";
import { GameSummary } from "@/lib/types";

// ---------------------------------------------------------------------------
// Tab status helpers
// ---------------------------------------------------------------------------

interface GameStatus {
  winner: string | null;
  phase: string | null;
}

function TabIndicator({ status }: { status: GameStatus }) {
  if (status.winner === "mafia") return <span className="text-rose-400 font-bold">✗</span>;
  if (status.winner === "village") return <span className="text-emerald-400 font-bold">✓</span>;
  if (status.winner) return <span className="text-neutral-400">─</span>;
  if (status.phase === "game_over") return <span className="text-neutral-400">─</span>;
  return <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />;
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------

function GamesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ids = searchParams.get("ids")?.split(",").filter(Boolean) ?? [];

  const [activeTab, setActiveTab] = useState<number | "metrics">(0);
  const [gameStatuses, setGameStatuses] = useState<GameStatus[]>(
    () => ids.map(() => ({ winner: null, phase: null }))
  );
  const [gameSummaries, setGameSummaries] = useState<GameSummary[]>([]);

  const makeStatusHandler = useCallback(
    (index: number) => (winner: string | null, phase: string | null) => {
      setGameStatuses((prev) => {
        const next = [...prev];
        next[index] = { winner, phase };
        return next;
      });
    },
    []
  );

  const handleGameComplete = useCallback((summary: GameSummary) => {
    setGameSummaries((prev) => {
      if (prev.some((s) => s.gameId === summary.gameId)) return prev;
      return [...prev, summary];
    });
  }, []);

  if (ids.length === 0) {
    return (
      <div className="h-screen bg-neutral-950 flex items-center justify-center text-neutral-500">
        No games found.{" "}
        <button onClick={() => router.push("/")} className="ml-2 underline hover:text-white">
          Go back
        </button>
      </div>
    );
  }

  const completedCount = gameSummaries.length;

  return (
    <div className="h-screen bg-neutral-950 flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 border-b border-neutral-800 shrink-0 h-10">
        <button
          onClick={() => router.push("/")}
          className="text-neutral-500 text-xs hover:text-white px-2 py-1 rounded transition-colors mr-2"
        >
          ← Back
        </button>
        <div className="w-px h-4 bg-neutral-800 mr-2" />

        {/* Game tabs */}
        {ids.map((id, i) => (
          <button
            key={id}
            onClick={() => setActiveTab(i)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-colors ${
              activeTab === i
                ? "bg-neutral-800 text-white"
                : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900"
            }`}
          >
            <span>Game {i + 1}</span>
            <TabIndicator status={gameStatuses[i]} />
          </button>
        ))}

        {/* Divider + Metrics tab */}
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
          {completedCount > 0 && (
            <span className="text-[10px] bg-neutral-700 text-neutral-300 px-1.5 py-0.5 rounded-full font-medium">
              {completedCount}
            </span>
          )}
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 relative">
        {/* Game views — all mounted, CSS-toggled */}
        {ids.map((id, i) => (
          <div
            key={id}
            style={{
              display: activeTab === i ? "flex" : "none",
              position: "absolute",
              inset: 0,
              flexDirection: "column",
            }}
          >
            <GameView
              gameId={id}
              onStatusChange={makeStatusHandler(i)}
              onGameComplete={handleGameComplete}
            />
          </div>
        ))}

        {/* Metrics view */}
        {activeTab === "metrics" && (
          <div style={{ position: "absolute", inset: 0 }}>
            <MetricsView summaries={gameSummaries} totalGames={ids.length} />
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page export
// ---------------------------------------------------------------------------

export default function GamesPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-neutral-950 flex items-center justify-center text-neutral-500 text-sm">
          Loading games...
        </div>
      }
    >
      <GamesContent />
    </Suspense>
  );
}
