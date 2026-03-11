"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Props {
  onStart: (gameId: string, streamUrl: string) => void;
}

const PLAYER_NAMES = [
  "Revant", "Thisya", "Baashish", "Gauranga",
  "Gian Reddy", "Harryshit", "Cheruku", "Remo Sai",
];

const ROLE_BREAKDOWN = [
  { role: "Mafia", count: 2, color: "bg-rose-900/60 text-rose-300 border-rose-800" },
  { role: "Doctor", count: 1, color: "bg-emerald-900/60 text-emerald-300 border-emerald-800" },
  { role: "Detective", count: 1, color: "bg-sky-900/60 text-sky-300 border-sky-800" },
  { role: "Villager", count: 4, color: "bg-neutral-800 text-neutral-300 border-neutral-700" },
];

export function SetupScreen({ onStart }: Props) {
  const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_OPENAI_API_KEY ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    if (!apiKey.trim()) {
      setError("API key is required.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
      const res = await fetch(`${BACKEND}/api/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "Failed to start game");
      }

      const data = await res.json();
      onStart(data.game_id, data.stream_url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg flex flex-col gap-6">

        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-white">Mafia</h1>
          <p className="text-neutral-500 mt-1 text-sm">9 AI agents. One game. No mercy.</p>
        </div>

        {/* Config card */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Start a New Game</CardTitle>
            <CardDescription className="text-neutral-500 text-sm">
              Connects to your local FastAPI server at port 8000.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-neutral-300 text-sm font-medium">OpenAI API Key</label>
              <Input
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                className="bg-neutral-800 border-neutral-700 text-white placeholder:text-neutral-600 focus-visible:ring-neutral-600"
              />
            </div>

            {error && (
              <p className="text-rose-400 text-sm">{error}</p>
            )}

            <Button
              onClick={handleStart}
              disabled={loading}
              className="w-full bg-white text-neutral-950 hover:bg-neutral-200 font-semibold"
            >
              {loading ? "Starting..." : "Start Game"}
            </Button>
          </CardContent>
        </Card>

        {/* Game info card */}
        <Card className="bg-neutral-900 border-neutral-800">
          <CardContent className="pt-5 flex flex-col gap-4">
            <div>
              <p className="text-neutral-400 text-xs uppercase tracking-widest mb-3 font-medium">
                Players
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PLAYER_NAMES.map((name) => (
                  <span
                    key={name}
                    className="text-xs bg-neutral-800 text-neutral-300 border border-neutral-700 px-2 py-1 rounded-md"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>

            <Separator className="bg-neutral-800" />

            <div>
              <p className="text-neutral-400 text-xs uppercase tracking-widest mb-3 font-medium">
                Role Distribution
              </p>
              <div className="flex flex-wrap gap-2">
                {ROLE_BREAKDOWN.map(({ role, count, color }) => (
                  <span
                    key={role}
                    className={`text-xs px-2.5 py-1 rounded-md border font-medium ${color}`}
                  >
                    {count}x {role}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
