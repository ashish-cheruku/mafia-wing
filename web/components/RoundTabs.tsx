"use client";

import { useState, useEffect, useRef } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ChatEntry } from "@/lib/types";

interface Props {
  rounds: number[];
  chatByRound: Record<number, ChatEntry[]>;
  nightLogByRound: Record<number, string[]>;
  eliminationByRound: Record<number, string[]>;
  currentRound: number;
  currentPhase: string | null;
}

function NightPanel({
  logs,
  eliminations,
}: {
  logs: string[];
  eliminations: string[];
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  if (logs.length === 0 && eliminations.length === 0) {
    return (
      <p className="text-neutral-600 text-xs italic p-6">
        No night activity recorded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      {logs.map((log, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
          <span className="text-neutral-300 text-sm leading-relaxed">{log}</span>
        </div>
      ))}
      {eliminations.length > 0 && (
        <>
          {logs.length > 0 && <Separator className="bg-neutral-800 my-2" />}
          {eliminations.map((name, i) => (
            <div
              key={`elim-${i}`}
              className="bg-rose-950/40 border border-rose-900 rounded-lg px-3 py-2.5"
            >
              <span className="text-rose-300 text-sm font-semibold">
                {name} was eliminated tonight
              </span>
            </div>
          ))}
        </>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

const ROLE_LABEL_STYLES: Record<string, string> = {
  mafia: "text-rose-400",
  doctor: "text-emerald-400",
  detective: "text-sky-400",
  villager: "text-neutral-500",
};

function DayPanel({ chats }: { chats: ChatEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  if (chats.length === 0) {
    return (
      <p className="text-neutral-600 text-xs italic p-6">
        No discussion recorded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-neutral-800/60">
      {chats.map((entry, i) => (
        <div key={i} className="px-4 py-3 flex gap-3">
          <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0">
            {entry.player_name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-neutral-200 text-xs font-semibold">{entry.player_name}</span>
            <p className="text-neutral-400 text-sm leading-relaxed mt-0.5">{entry.message}</p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

export function RoundTabs({
  rounds,
  chatByRound,
  nightLogByRound,
  eliminationByRound,
  currentRound,
  currentPhase,
}: Props) {
  const [selectedRound, setSelectedRound] = useState(currentRound);

  useEffect(() => {
    setSelectedRound(currentRound);
  }, [currentRound]);

  const defaultSubTab =
    currentPhase === "night" || selectedRound < currentRound ? "night" : "day";

  if (rounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-neutral-600">
        <p className="text-sm">Waiting for game to start...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* Round selector */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-0 border-b border-neutral-800 overflow-x-auto shrink-0">
        {rounds.map((rn) => (
          <button
            key={rn}
            onClick={() => setSelectedRound(rn)}
            className={`
              relative px-4 py-2 text-xs font-medium transition-colors whitespace-nowrap border-b-2
              ${selectedRound === rn
                ? "text-white border-white"
                : "text-neutral-500 border-transparent hover:text-neutral-300 hover:border-neutral-600"
              }
            `}
          >
            Round {rn}
            {rn === currentRound && (
              <span className="absolute top-1.5 right-1 w-1 h-1 rounded-full bg-emerald-400" />
            )}
          </button>
        ))}
      </div>

      {/* Night / Day sub-tabs */}
      <Tabs
        defaultValue={defaultSubTab}
        key={`${selectedRound}-${defaultSubTab}`}
        className="flex flex-col flex-1 min-h-0"
      >
        <div className="px-4 pt-3 shrink-0">
          <TabsList className="h-8 bg-neutral-900 border border-neutral-800 p-0.5">
            <TabsTrigger
              value="night"
              className="h-7 px-3 text-xs data-active:bg-neutral-700 data-active:text-white text-neutral-500"
            >
              Night
            </TabsTrigger>
            <TabsTrigger
              value="day"
              className="h-7 px-3 text-xs data-active:bg-neutral-700 data-active:text-white text-neutral-500"
            >
              Day Discussion
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="night" className="flex-1 min-h-0 mt-2 overflow-hidden">
          <ScrollArea className="h-full">
            <NightPanel
              logs={nightLogByRound[selectedRound] ?? []}
              eliminations={eliminationByRound[selectedRound] ?? []}
            />
          </ScrollArea>
        </TabsContent>

        <TabsContent value="day" className="flex-1 min-h-0 mt-2 overflow-hidden">
          <ScrollArea className="h-full">
            <DayPanel chats={chatByRound[selectedRound] ?? []} />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
