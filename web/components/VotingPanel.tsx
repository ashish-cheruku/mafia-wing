"use client";

import { VoteEntry } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  votes: VoteEntry[];
  trialSuspect: string | null;
  trialVotes: number;
  defenseSpeech: string | null;
  totalPlayers: number;
}

export function VotingPanel({
  votes,
  trialSuspect,
  trialVotes,
  defenseSpeech,
  totalPlayers,
}: Props) {
  const tally: Record<string, number> = {};
  for (const v of votes) {
    tally[v.target] = (tally[v.target] ?? 0) + 1;
  }
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const maxVotes = sorted[0]?.[1] ?? 1;

  return (
    <div className="flex flex-col gap-4 h-full">

      {/* Vote tally */}
      {sorted.length > 0 && (
        <div>
          <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-3">
            Vote Tally
          </p>
          <div className="flex flex-col gap-2.5">
            {sorted.map(([name, count]) => (
              <div key={name}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-neutral-300 text-xs font-medium truncate max-w-[140px]">{name}</span>
                  <span className="text-neutral-500 text-xs tabular-nums">{count}/{totalPlayers}</span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-1.5">
                  <div
                    className="bg-rose-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${(count / maxVotes) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trial banner */}
      {trialSuspect && (
        <>
          {sorted.length > 0 && <Separator className="bg-neutral-800" />}
          <Card className="bg-amber-950/40 border-amber-800">
            <CardContent className="pt-4 pb-3 px-3">
              <p className="text-amber-200 text-xs font-semibold">{trialSuspect} is on trial</p>
              <p className="text-amber-400 text-xs mt-0.5">{trialVotes} vote{trialVotes !== 1 ? "s" : ""} against</p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Defense speech */}
      {defenseSpeech && (
        <>
          <Separator className="bg-neutral-800" />
          <div>
            <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-2">
              {trialSuspect ?? "Suspect"}&apos;s Defense
            </p>
            <Card className="bg-neutral-800/60 border-neutral-700">
              <CardContent className="pt-3 pb-3 px-3">
                <p className="text-neutral-200 text-xs leading-relaxed italic">&ldquo;{defenseSpeech}&rdquo;</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Vote log */}
      {votes.length > 0 && (
        <>
          <Separator className="bg-neutral-800" />
          <div className="flex-1 min-h-0">
            <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-2">
              Votes Cast
            </p>
            <ScrollArea className="h-[180px]">
              <div className="flex flex-col gap-1.5 pr-2">
                {votes.map((v, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <span className="text-neutral-300 font-medium truncate max-w-[70px]">{v.voter}</span>
                    <span className="text-neutral-600">voted</span>
                    <span className="text-rose-400 font-medium truncate max-w-[70px]">{v.target}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}
