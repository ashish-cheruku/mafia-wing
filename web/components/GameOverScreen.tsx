"use client";

import { useState } from "react";
import { PlayerFinalState, ChatEntry } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

const WINNER_CONFIG: Record<string, { label: string; accent: string; border: string; bg: string }> = {
  village: {
    label: "Village Wins",
    accent: "text-emerald-400",
    border: "border-emerald-900",
    bg: "bg-emerald-950/20",
  },
  mafia: {
    label: "Mafia Wins",
    accent: "text-rose-400",
    border: "border-rose-900",
    bg: "bg-rose-950/20",
  },
  tie: {
    label: "Tie Game",
    accent: "text-neutral-300",
    border: "border-neutral-800",
    bg: "bg-neutral-900/40",
  },
};

const ROLE_STYLES: Record<string, string> = {
  mafia:     "bg-rose-950 text-rose-300 border-rose-800",
  doctor:    "bg-emerald-950 text-emerald-300 border-emerald-800",
  detective: "bg-sky-950 text-sky-300 border-sky-800",
  villager:  "bg-neutral-800 text-neutral-400 border-neutral-700",
};

const ROLE_LABEL: Record<string, string> = {
  mafia: "Mafia", doctor: "Doctor", detective: "Detective", villager: "Villager",
};

function getInitials(name: string): string {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

interface Props {
  winner: string;
  finalPlayerStates: PlayerFinalState[];
  eliminationOrder: string[];
  rounds: number[];
  chatByRound: Record<number, ChatEntry[]>;
  nightLogByRound: Record<number, string[]>;
  eliminationByRound: Record<number, string[]>;
  onPlayAgain?: () => void;
}

type Tab = "overview" | "history";

export function GameOverScreen({
  winner,
  finalPlayerStates,
  eliminationOrder,
  rounds,
  chatByRound,
  nightLogByRound,
  eliminationByRound,
  onPlayAgain,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const cfg = WINNER_CONFIG[winner] ?? WINNER_CONFIG.tie;

  async function handleDownloadPDF() {
    // Dynamically import jspdf to avoid SSR issues
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const pageW = doc.internal.pageSize.getWidth();
    const margin = 16;
    const contentW = pageW - margin * 2;
    let y = 20;

    const LINE_H = 6;
    const SECTION_GAP = 8;

    function ensurePage(needed = LINE_H) {
      if (y + needed > 277) {
        doc.addPage();
        y = 20;
      }
    }

    function drawText(text: string, size: number, style: "normal" | "bold", color: [number, number, number], indent = 0) {
      doc.setFontSize(size);
      doc.setFont("helvetica", style);
      doc.setTextColor(...color);
      const lines = doc.splitTextToSize(text, contentW - indent);
      for (const line of lines) {
        ensurePage();
        doc.text(line, margin + indent, y);
        y += LINE_H;
      }
    }

    // White background (default for jsPDF)
    const BLACK: [number, number, number] = [0, 0, 0];
    const DARK_GRAY: [number, number, number] = [50, 50, 50];
    const MID_GRAY: [number, number, number] = [100, 100, 100];
    const LIGHT_GRAY: [number, number, number] = [140, 140, 140];

    // Title
    drawText("Mafia — Game Transcript", 18, "bold", BLACK);
    y += 2;
    drawText(cfg.label, 13, "bold", DARK_GRAY);
    y += SECTION_GAP;

    // Role reveal
    drawText("Final Roles", 11, "bold", MID_GRAY);
    y += 2;
    for (const p of finalPlayerStates) {
      const status = p.is_alive ? "survived" : "eliminated";
      drawText(`${p.name}  —  ${ROLE_LABEL[p.role] ?? p.role}  (${status})`, 9, "normal", DARK_GRAY, 4);
    }
    y += SECTION_GAP;

    // Elimination order
    if (eliminationOrder.length > 0) {
      drawText("Elimination Order", 11, "bold", MID_GRAY);
      y += 2;
      drawText(eliminationOrder.map((n, i) => `${i + 1}. ${n}`).join("  >  "), 9, "normal", DARK_GRAY, 4);
      y += SECTION_GAP;
    }

    // Separator
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pageW - margin, y);
    y += SECTION_GAP;

    // Rounds
    for (const rn of rounds) {
      const nightLogs = nightLogByRound[rn] ?? [];
      const eliminations = eliminationByRound[rn] ?? [];
      const chats = chatByRound[rn] ?? [];
      if (nightLogs.length === 0 && eliminations.length === 0 && chats.length === 0) continue;

      ensurePage(10);
      drawText(`Round ${rn}`, 12, "bold", BLACK);
      y += 2;

      if (nightLogs.length > 0 || eliminations.length > 0) {
        drawText("Night", 10, "bold", MID_GRAY);
        y += 1;
        for (const log of nightLogs) {
          drawText(`- ${log}`, 9, "normal", DARK_GRAY, 4);
        }
        for (const name of eliminations) {
          drawText(`- ${name} was eliminated tonight`, 9, "bold", DARK_GRAY, 4);
        }
        y += 3;
      }

      if (chats.length > 0) {
        drawText("Day Discussion", 10, "bold", MID_GRAY);
        y += 1;
        for (const entry of chats) {
          drawText(`${entry.player_name}:`, 9, "bold", DARK_GRAY, 4);
          drawText(entry.message, 9, "normal", LIGHT_GRAY, 8);
          y += 1;
        }
      }

      y += SECTION_GAP;
    }

    doc.save("mafia-transcript.pdf");
  }

  return (
    <div className="h-full bg-neutral-950 text-white flex flex-col">

      {/* Header */}
      <header className="flex items-center gap-4 px-6 h-14 border-b border-neutral-800 shrink-0">
        <span className="text-white font-semibold tracking-tight text-sm">Mafia</span>
        <Separator orientation="vertical" className="h-4 bg-neutral-700" />
        <span className={`text-sm font-semibold ${cfg.accent}`}>{cfg.label}</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-neutral-900 border border-neutral-800 rounded-md p-0.5">
            {(["overview", "history"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors
                  ${tab === t ? "bg-neutral-700 text-white" : "text-neutral-500 hover:text-neutral-300"}`}
              >
                {t === "overview" ? "Overview" : "Conversation History"}
              </button>
            ))}
          </div>

          {/* Download PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            className="h-7 text-xs border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white"
          >
            Download PDF
          </Button>

          {/* Play Again */}
          {onPlayAgain && (
            <Button
              size="sm"
              onClick={onPlayAgain}
              className="h-7 text-xs bg-white text-neutral-950 hover:bg-neutral-200 font-semibold"
            >
              Play Again
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "overview" ? (
          <OverviewTab cfg={cfg} finalPlayerStates={finalPlayerStates} eliminationOrder={eliminationOrder} />
        ) : (
          <HistoryTab
            rounds={rounds}
            chatByRound={chatByRound}
            nightLogByRound={nightLogByRound}
            eliminationByRound={eliminationByRound}
            finalPlayerStates={finalPlayerStates}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview tab                                                                 */
/* -------------------------------------------------------------------------- */

function OverviewTab({
  cfg,
  finalPlayerStates,
  eliminationOrder,
}: {
  cfg: typeof WINNER_CONFIG[string];
  finalPlayerStates: PlayerFinalState[];
  eliminationOrder: string[];
}) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col items-center gap-8 px-6 py-12 max-w-2xl mx-auto">

        <Card className={`w-full border ${cfg.border} ${cfg.bg}`}>
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-1.5">
            <p className="text-neutral-500 text-xs uppercase tracking-widest font-medium">Game Over</p>
            <h1 className={`text-4xl font-bold tracking-tight ${cfg.accent}`}>{cfg.label}</h1>
          </CardContent>
        </Card>

        <div className="w-full">
          <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-4">
            Full Role Reveal
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {finalPlayerStates.map((p) => (
              <Card
                key={p.name}
                className={`border ${p.is_alive ? "bg-neutral-900 border-neutral-700" : "bg-neutral-950 border-neutral-800 opacity-50"}`}
              >
                <CardContent className="pt-3 pb-3 px-3 flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                    ${p.is_alive ? "bg-neutral-700 text-neutral-100" : "bg-neutral-800 text-neutral-500"}`}>
                    {getInitials(p.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-xs font-semibold truncate">{p.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${ROLE_STYLES[p.role] ?? ROLE_STYLES.villager}`}>
                      {ROLE_LABEL[p.role] ?? p.role}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {eliminationOrder.length > 0 && (
          <div className="w-full">
            <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-4">
              Elimination Order
            </p>
            <div className="flex flex-wrap gap-2">
              {eliminationOrder.map((name, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="bg-neutral-900 text-neutral-300 text-xs px-3 py-1.5 rounded-md border border-neutral-800 font-medium">
                    {i + 1}. {name}
                  </span>
                  {i < eliminationOrder.length - 1 && (
                    <span className="text-neutral-700 text-xs">—</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

/* -------------------------------------------------------------------------- */
/* History tab                                                                  */
/* -------------------------------------------------------------------------- */

function HistoryTab({
  rounds,
  chatByRound,
  nightLogByRound,
  eliminationByRound,
  finalPlayerStates,
}: {
  rounds: number[];
  chatByRound: Record<number, ChatEntry[]>;
  nightLogByRound: Record<number, string[]>;
  eliminationByRound: Record<number, string[]>;
  finalPlayerStates: PlayerFinalState[];
}) {
  const roleMap = Object.fromEntries(finalPlayerStates.map((p) => [p.name, p.role]));

  if (rounds.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-600 text-sm">
        No conversation recorded.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-10">
        {rounds.map((rn) => {
          const nightLogs = nightLogByRound[rn] ?? [];
          const eliminations = eliminationByRound[rn] ?? [];
          const chats = chatByRound[rn] ?? [];
          if (nightLogs.length === 0 && eliminations.length === 0 && chats.length === 0) return null;

          return (
            <div key={rn} className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold text-sm">Round {rn}</span>
                <div className="flex-1 h-px bg-neutral-800" />
              </div>

              {(nightLogs.length > 0 || eliminations.length > 0) && (
                <div>
                  <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-2.5">Night</p>
                  <Card className="bg-neutral-900/60 border-neutral-800">
                    <CardContent className="pt-3 pb-3 px-4 flex flex-col gap-2">
                      {nightLogs.map((log, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="w-1 h-1 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                          <span className="text-neutral-300 text-sm leading-relaxed">{log}</span>
                        </div>
                      ))}
                      {eliminations.map((name, i) => (
                        <div key={`e-${i}`} className="mt-1 rounded-md bg-rose-950/40 border border-rose-900 px-3 py-2">
                          <span className="text-rose-300 text-sm font-semibold">{name} was eliminated tonight</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}

              {chats.length > 0 && (
                <div>
                  <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-2.5">Day Discussion</p>
                  <div className="flex flex-col divide-y divide-neutral-800/60 border border-neutral-800 rounded-lg overflow-hidden">
                    {chats.map((entry, i) => {
                      const role = roleMap[entry.player_name];
                      const roleStyle = ROLE_STYLES[role] ?? ROLE_STYLES.villager;
                      const roleLabel = ROLE_LABEL[role] ?? role;
                      return (
                        <div key={i} className="px-4 py-3 flex gap-3 bg-neutral-900/40">
                          <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-200 shrink-0">
                            {getInitials(entry.player_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-neutral-100 text-xs font-semibold">{entry.player_name}</span>
                              {role && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${roleStyle}`}>
                                  {roleLabel}
                                </span>
                              )}
                            </div>
                            <p className="text-neutral-400 text-sm leading-relaxed">{entry.message}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
