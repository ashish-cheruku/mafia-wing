"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { GameView } from "@/components/GameView";

interface PageProps {
  params: Promise<{ gameId: string }>;
}

export default function GamePage({ params }: PageProps) {
  const { gameId } = use(params);
  const router = useRouter();

  return (
    <div className="h-screen">
      <GameView gameId={gameId} onPlayAgain={() => router.push("/")} />
    </div>
  );
}
