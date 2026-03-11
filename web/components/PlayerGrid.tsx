"use client";

import { PlayerCard } from "./PlayerCard";
import { PlayerInfo, PlayerFinalState } from "@/lib/types";

interface Props {
  players: PlayerInfo[];
  alivePlayers: Set<string>;
  trialSuspect?: string | null;
  votes?: { voter: string; target: string }[];
  finalStates?: PlayerFinalState[];
}

export function PlayerGrid({
  players,
  alivePlayers,
  trialSuspect,
  votes = [],
  finalStates = [],
}: Props) {
  const voteTally: Record<string, number> = {};
  for (const v of votes) {
    voteTally[v.target] = (voteTally[v.target] ?? 0) + 1;
  }

  const displayPlayers = players.map((p) => {
    const final = finalStates.find((f) => f.name === p.name);
    return final ? { ...p, role: final.role } : p;
  });

  return (
    <div className="grid grid-cols-3 gap-2 p-3">
      {displayPlayers.map((player) => (
        <PlayerCard
          key={player.name}
          player={player}
          isAlive={alivePlayers.has(player.name)}
          isOnTrial={player.name === trialSuspect}
          voteCount={voteTally[player.name] ?? 0}
        />
      ))}
    </div>
  );
}
