"use client";

import { useCallback, useEffect, useRef } from "react";
import { useGameState } from "@/hooks/useGameState";
import { useGameSSE } from "@/hooks/useGameSSE";
import { GameSummary } from "@/lib/types";
import { PhaseHeader } from "@/components/PhaseHeader";
import { PlayerGrid } from "@/components/PlayerGrid";
import { RoundTabs } from "@/components/RoundTabs";
import { VotingPanel } from "@/components/VotingPanel";
import { GameOverScreen } from "@/components/GameOverScreen";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

interface Props {
  gameId: string;
  onPlayAgain?: () => void;
  onStatusChange?: (winner: string | null, phase: string | null) => void;
  onGameComplete?: (summary: GameSummary) => void;
}

export function GameView({ gameId, onPlayAgain, onStatusChange, onGameComplete }: Props) {
  const { state, handleEvent, setStatus } = useGameState();
  const firedComplete = useRef(false);

  useGameSSE(
    `/api/stream/${gameId}`,
    handleEvent,
    () => setStatus("finished"),
  );

  useEffect(() => {
    onStatusChange?.(state.winner, state.phase);
  }, [state.winner, state.phase, onStatusChange]);

  useEffect(() => {
    if (
      !firedComplete.current &&
      state.winner &&
      state.finalPlayerStates.length > 0 &&
      onGameComplete
    ) {
      firedComplete.current = true;
      onGameComplete({
        gameId,
        winner: state.winner,
        roundsPlayed: state.rounds.length > 0 ? Math.max(...state.rounds) : state.roundNumber,
        rounds: state.rounds,
        finalPlayerStates: state.finalPlayerStates,
        eliminationOrder: state.eliminationOrder,
        eliminationByRound: state.eliminationByRound,
        chatByRound: state.chatByRound,
        nightLogByRound: state.nightLogByRound,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.winner, state.finalPlayerStates.length]);

  const handlePlayAgain = useCallback(() => {
    onPlayAgain?.();
  }, [onPlayAgain]);

  const isVoting =
    state.phase === "voting" ||
    state.phase === "defense" ||
    state.phase === "final_voting";

  const isGameOver =
    state.phase === "game_over" || state.status === "finished";

  if (isGameOver && state.winner) {
    return (
      <GameOverScreen
        winner={state.winner}
        finalPlayerStates={state.finalPlayerStates}
        eliminationOrder={state.eliminationOrder}
        rounds={state.rounds}
        chatByRound={state.chatByRound}
        nightLogByRound={state.nightLogByRound}
        eliminationByRound={state.eliminationByRound}
        onPlayAgain={onPlayAgain ? handlePlayAgain : undefined}
      />
    );
  }

  return (
    <div className="h-full bg-neutral-950 text-white flex flex-col">
      <PhaseHeader phase={state.phase} roundNumber={state.roundNumber} />

      <div className="flex flex-1 min-h-0">
        {/* Left: Player Grid */}
        <aside className="w-[280px] border-r border-neutral-800 overflow-y-auto shrink-0 bg-neutral-950">
          <div className="p-3 border-b border-neutral-800">
            <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium">
              Players — {state.alivePlayers.size} alive
            </p>
          </div>
          <PlayerGrid
            players={state.players}
            alivePlayers={state.alivePlayers}
            trialSuspect={state.trialSuspect}
            votes={state.votes}
          />
        </aside>

        {/* Center: Round Tabs */}
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <RoundTabs
            rounds={state.rounds}
            chatByRound={state.chatByRound}
            nightLogByRound={state.nightLogByRound}
            eliminationByRound={state.eliminationByRound}
            currentRound={state.roundNumber}
            currentPhase={state.phase}
          />
        </main>

        {/* Right: Voting Panel */}
        {isVoting && (
          <>
            <Separator orientation="vertical" className="bg-neutral-800" />
            <aside className="w-[260px] p-4 overflow-y-auto shrink-0">
              <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-4">
                Voting
              </p>
              <VotingPanel
                votes={state.votes}
                trialSuspect={state.trialSuspect}
                trialVotes={state.trialVotes}
                defenseSpeech={state.defenseSpeech}
                totalPlayers={state.alivePlayers.size}
              />
            </aside>
          </>
        )}
      </div>

      {/* Status bar */}
      <footer className="border-t border-neutral-800 px-6 h-9 flex items-center gap-3 shrink-0">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            state.status === "running"
              ? "bg-emerald-400 animate-pulse"
              : state.status === "finished"
              ? "bg-neutral-500"
              : "bg-rose-500"
          }`}
        />
        <span className="text-neutral-600 text-xs truncate">
          {state.status === "running"
            ? `Round ${state.roundNumber} in progress`
            : state.status === "finished"
            ? "Game finished"
            : state.error ?? "Connecting..."}
        </span>
        {onPlayAgain && (
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePlayAgain}
              className="h-6 text-[11px] border-neutral-700 bg-transparent text-neutral-500 hover:text-white hover:bg-neutral-800"
            >
              Restart Game
            </Button>
          </div>
        )}
      </footer>
    </div>
  );
}
