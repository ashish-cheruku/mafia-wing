"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatEntry } from "@/lib/types";

interface Props {
  entries: ChatEntry[];
}

export function ChatFeed({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-500 text-sm">
        No discussion yet…
      </div>
    );
  }

  return (
    <ScrollArea className="h-full pr-2">
      <div className="flex flex-col gap-2 p-4">
        {entries.map((entry, i) => (
          <div key={i} className="flex gap-2">
            <span className="text-neutral-400 font-semibold text-sm min-w-[80px]">
              {entry.player_name}
            </span>
            <span className="text-neutral-200 text-sm">{entry.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
