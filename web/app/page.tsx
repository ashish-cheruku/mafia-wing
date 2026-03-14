"use client";

import { useRouter } from "next/navigation";
import { SetupScreen } from "@/components/SetupScreen";

interface GameResult {
  gameId: string;
  streamUrl: string;
}

export default function Home() {
  const router = useRouter();

  function handleStart(games: GameResult[]) {
    if (games.length === 1) {
      router.push(`/game/${games[0].gameId}`);
    } else {
      const ids = games.map((g) => g.gameId).join(",");
      router.push(`/games?ids=${ids}`);
    }
  }

  return <SetupScreen onStart={handleStart} />;
}
