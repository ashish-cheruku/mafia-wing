"use client";

import { useEffect, useRef } from "react";
import { SSEEvent } from "@/lib/types";

export function useGameSSE(
  streamUrl: string | null,
  onEvent: (event: SSEEvent) => void,
  onDone: () => void
) {
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!streamUrl) return;

    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
    const es = new EventSource(`${BACKEND}${streamUrl}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data) as SSEEvent;
        onEvent(parsed);
      } catch {
        // ignore malformed frames
      }
    };

    es.addEventListener("done", () => {
      es.close();
      onDone();
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);
}
