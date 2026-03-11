"use client";

import { PlayerInfo } from "@/lib/types";

const ROLE_STYLES: Record<string, { badge: string; label: string }> = {
  mafia:     { badge: "bg-rose-950 text-rose-300 border-rose-800",       label: "Mafia" },
  doctor:    { badge: "bg-emerald-950 text-emerald-300 border-emerald-800", label: "Doctor" },
  detective: { badge: "bg-sky-950 text-sky-300 border-sky-800",           label: "Detective" },
  villager:  { badge: "bg-neutral-800 text-neutral-400 border-neutral-700", label: "Villager" },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

interface Props {
  player: PlayerInfo;
  isAlive: boolean;
  isOnTrial?: boolean;
  voteCount?: number;
}

export function PlayerCard({
  player,
  isAlive,
  isOnTrial = false,
  voteCount = 0,
}: Props) {
  const style = ROLE_STYLES[player.role] ?? ROLE_STYLES.villager;

  return (
    <div
      className={`
        relative rounded-lg p-2.5 border flex flex-col items-center gap-1.5 transition-all
        ${isAlive
          ? "bg-neutral-900 border-neutral-800"
          : "bg-neutral-950 border-neutral-800/50 opacity-40"}
        ${isOnTrial ? "border-amber-500 ring-1 ring-amber-500/20" : ""}
      `}
    >
      {/* Vote badge */}
      {voteCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-sm">
          {voteCount}
        </span>
      )}

      {/* Trial label */}
      {isOnTrial && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap leading-none">
          On Trial
        </span>
      )}

      {/* Avatar */}
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold tracking-wide
          ${isAlive ? "bg-neutral-700 text-neutral-100" : "bg-neutral-800 text-neutral-500"}`}
      >
        {getInitials(player.name)}
      </div>

      {/* Name */}
      <span className={`text-[11px] font-semibold text-center leading-tight w-full truncate px-0.5 ${isAlive ? "text-neutral-200" : "text-neutral-500"}`}>
        {player.name}
      </span>

      {/* Role — always shown */}
      {isAlive ? (
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium leading-none ${style.badge}`}>
          {style.label}
        </span>
      ) : (
        <span className="text-[10px] text-neutral-700 font-medium">eliminated</span>
      )}
    </div>
  );
}
