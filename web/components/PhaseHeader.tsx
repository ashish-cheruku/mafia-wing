"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Phase } from "@/lib/types";

const PHASE_LABELS: Record<string, string> = {
  night: "Night Phase",
  day: "Day Discussion",
  voting: "Voting",
  defense: "Defense",
  final_voting: "Final Vote",
  game_over: "Game Over",
};

const PHASE_VARIANTS: Record<string, string> = {
  night: "bg-indigo-950 text-indigo-300 border-indigo-800",
  day: "bg-amber-950 text-amber-300 border-amber-800",
  voting: "bg-orange-950 text-orange-300 border-orange-800",
  defense: "bg-purple-950 text-purple-300 border-purple-800",
  final_voting: "bg-rose-950 text-rose-300 border-rose-800",
  game_over: "bg-neutral-800 text-neutral-300 border-neutral-700",
};

interface Props {
  phase: Phase | null;
  roundNumber: number;
}

export function PhaseHeader({ phase, roundNumber }: Props) {
  const label = phase ? (PHASE_LABELS[phase] ?? phase) : "Waiting...";
  const variant = phase ? (PHASE_VARIANTS[phase] ?? "bg-neutral-800 text-neutral-300 border-neutral-700") : "bg-neutral-800 text-neutral-300 border-neutral-700";

  return (
    <header className="flex items-center gap-4 px-6 h-14 border-b border-neutral-800 shrink-0 bg-neutral-950">
      <span className="text-white font-semibold tracking-tight text-sm">Mafia</span>
      <Separator orientation="vertical" className="h-4 bg-neutral-700" />
      <span className="text-neutral-500 text-sm">Round {roundNumber}</span>
      <span
        className={`ml-1 inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${variant}`}
      >
        {label}
      </span>
    </header>
  );
}
