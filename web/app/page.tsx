"use client";

import { useRouter } from "next/navigation";
import { SetupScreen } from "@/components/SetupScreen";

export default function Home() {
  const router = useRouter();

  function handleStart(gameId: string, _streamUrl: string) {
    router.push(`/game/${gameId}`);
  }

  return <SetupScreen onStart={handleStart} />;
}
