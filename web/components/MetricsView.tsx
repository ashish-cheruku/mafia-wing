"use client";

import { useCallback } from "react";
import { GameSummary, PlayerFinalState } from "@/lib/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerStats {
  name: string;
  games: number;
  roleBreakdown: Record<string, number>;
  wins: number;
  winRate: number;
  survivals: number;
  survivalRate: number;
  avgElimPosition: number | null;
  timesFirstEliminated: number;
  timesLastEliminated: number;
  timesAsDetective: number;
  mafiaWinsAgainst: number; // times this player was on village and mafia won
}

interface RoleStats {
  role: string;
  appearances: number;
  wins: number;
  winRate: number;
  avgElimRound: number | null;
  survivals: number;
}

interface Props {
  summaries: GameSummary[];
  totalGames: number;
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

const VILLAGE_ROLES = ["doctor", "detective", "villager"];
const ROLE_LABEL: Record<string, string> = {
  mafia: "Mafia",
  doctor: "Doctor",
  detective: "Detective",
  villager: "Villager",
};
const ROLE_COLOR: Record<string, string> = {
  mafia: "text-rose-400",
  doctor: "text-emerald-400",
  detective: "text-sky-400",
  villager: "text-neutral-400",
};

function isOnWinningTeam(player: PlayerFinalState, winner: string): boolean {
  if (winner === "mafia") return player.role === "mafia";
  if (winner === "village") return VILLAGE_ROLES.includes(player.role);
  return false; // tie
}

function computePlayerStats(summaries: GameSummary[]): PlayerStats[] {
  const allNames = new Set<string>();
  for (const s of summaries)
    for (const p of s.finalPlayerStates) allNames.add(p.name);

  return Array.from(allNames)
    .map((name) => {
      const games = summaries.filter((s) =>
        s.finalPlayerStates.some((p) => p.name === name)
      );
      const roleBreakdown: Record<string, number> = {};
      let wins = 0, survivals = 0, totalElimPos = 0, elimCount = 0;
      let timesFirst = 0, timesLast = 0, timesDetective = 0, mafiaWinsAgainst = 0;

      for (const game of games) {
        const player = game.finalPlayerStates.find((p) => p.name === name)!;
        roleBreakdown[player.role] = (roleBreakdown[player.role] || 0) + 1;

        if (isOnWinningTeam(player, game.winner)) wins++;
        if (player.is_alive) survivals++;
        if (player.role === "detective") timesDetective++;
        if (player.role !== "mafia" && game.winner === "mafia") mafiaWinsAgainst++;

        const elimPos = game.eliminationOrder.indexOf(name);
        if (elimPos !== -1) {
          totalElimPos += elimPos + 1;
          elimCount++;
          if (elimPos === 0) timesFirst++;
          if (elimPos === game.eliminationOrder.length - 1) timesLast++;
        }
      }

      return {
        name,
        games: games.length,
        roleBreakdown,
        wins,
        winRate: games.length > 0 ? wins / games.length : 0,
        survivals,
        survivalRate: games.length > 0 ? survivals / games.length : 0,
        avgElimPosition: elimCount > 0 ? totalElimPos / elimCount : null,
        timesFirstEliminated: timesFirst,
        timesLastEliminated: timesLast,
        timesAsDetective: timesDetective,
        mafiaWinsAgainst,
      };
    })
    .sort((a, b) => b.winRate - a.winRate);
}

function computeRoleStats(summaries: GameSummary[]): RoleStats[] {
  const roles = ["mafia", "doctor", "detective", "villager"];
  return roles.map((role) => {
    let appearances = 0, wins = 0, survivals = 0;
    let totalElimRound = 0, elimRoundCount = 0;

    for (const game of summaries) {
      for (const p of game.finalPlayerStates) {
        if (p.role !== role) continue;
        appearances++;
        if (isOnWinningTeam(p, game.winner)) wins++;
        if (p.is_alive) survivals++;

        // Find elimination round
        const elimIdx = game.eliminationOrder.indexOf(p.name);
        if (elimIdx !== -1) {
          // Map elimination order index to round
          for (const [roundStr, names] of Object.entries(game.eliminationByRound)) {
            if ((names as string[]).includes(p.name)) {
              totalElimRound += parseInt(roundStr);
              elimRoundCount++;
              break;
            }
          }
        }
      }
    }

    return {
      role,
      appearances,
      wins,
      winRate: appearances > 0 ? wins / appearances : 0,
      avgElimRound: elimRoundCount > 0 ? totalElimRound / elimRoundCount : null,
      survivals,
    };
  });
}

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function downloadJSON(summaries: GameSummary[], totalGames: number) {
  const completed = summaries.length;
  const villageWins = summaries.filter((s) => s.winner === "village").length;
  const mafiaWins = summaries.filter((s) => s.winner === "mafia").length;
  const ties = summaries.filter((s) => s.winner === "tie").length;
  const avgRounds =
    completed > 0
      ? summaries.reduce((sum, s) => sum + s.roundsPlayed, 0) / completed
      : 0;

  const playerStats = computePlayerStats(summaries);
  const roleStats = computeRoleStats(summaries);

  const data = {
    generated_at: new Date().toISOString(),
    total_games_started: totalGames,
    games_completed: completed,
    aggregate: {
      village_wins: villageWins,
      mafia_wins: mafiaWins,
      ties,
      avg_rounds: parseFloat(avgRounds.toFixed(2)),
      village_win_rate: completed > 0 ? parseFloat((villageWins / completed).toFixed(3)) : 0,
      mafia_win_rate: completed > 0 ? parseFloat((mafiaWins / completed).toFixed(3)) : 0,
    },
    player_stats: playerStats,
    role_stats: roleStats,
    games: summaries.map((s) => ({
      game_id: s.gameId,
      winner: s.winner,
      rounds_played: s.roundsPlayed,
      elimination_order: s.eliminationOrder,
      final_player_states: s.finalPlayerStates,
    })),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `mafia-metrics-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadPDF(summaries: GameSummary[], totalGames: number) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 20;
  const LH = 6;
  const GAP = 8;

  const ensurePage = (need = LH) => {
    if (y + need > 277) { doc.addPage(); y = 20; }
  };

  const txt = (
    s: string,
    size: number,
    style: "normal" | "bold",
    color: [number, number, number],
    indent = 0
  ) => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(s, contentW - indent);
    for (const line of lines) {
      ensurePage();
      doc.text(line, margin + indent, y);
      y += LH;
    }
  };

  const BLACK: [number, number, number] = [0, 0, 0];
  const DARK: [number, number, number] = [40, 40, 40];
  const MID: [number, number, number] = [100, 100, 100];
  const LIGHT: [number, number, number] = [150, 150, 150];

  const completed = summaries.length;
  const villageWins = summaries.filter((s) => s.winner === "village").length;
  const mafiaWins = summaries.filter((s) => s.winner === "mafia").length;
  const ties = summaries.filter((s) => s.winner === "tie").length;
  const avgRounds =
    completed > 0 ? summaries.reduce((sum, s) => sum + s.roundsPlayed, 0) / completed : 0;
  const playerStats = computePlayerStats(summaries);
  const roleStats = computeRoleStats(summaries);

  // Title
  txt("Mafia — Comprehensive Metrics", 18, "bold", BLACK);
  txt(`Generated ${new Date().toLocaleString()}`, 9, "normal", LIGHT);
  y += 4;

  // Summary
  txt("Summary", 12, "bold", DARK);
  y += 2;
  txt(`Games completed: ${completed} / ${totalGames}`, 10, "normal", DARK, 4);
  txt(`Village wins: ${villageWins} (${completed > 0 ? Math.round((villageWins / completed) * 100) : 0}%)`, 10, "normal", DARK, 4);
  txt(`Mafia wins:   ${mafiaWins} (${completed > 0 ? Math.round((mafiaWins / completed) * 100) : 0}%)`, 10, "normal", DARK, 4);
  if (ties > 0) txt(`Ties: ${ties}`, 10, "normal", DARK, 4);
  txt(`Average rounds per game: ${avgRounds.toFixed(1)}`, 10, "normal", DARK, 4);
  txt(`Round range: ${Math.min(...summaries.map((s) => s.roundsPlayed))} – ${Math.max(...summaries.map((s) => s.roundsPlayed))}`, 10, "normal", DARK, 4);
  y += GAP;

  // Role analysis
  txt("Role Analysis", 12, "bold", DARK);
  y += 2;
  for (const r of roleStats) {
    ensurePage(12);
    txt(
      `${ROLE_LABEL[r.role]}: ${r.appearances} appearances, win rate ${Math.round(r.winRate * 100)}%, survival rate ${r.appearances > 0 ? Math.round((r.survivals / r.appearances) * 100) : 0}%${r.avgElimRound !== null ? `, avg elim round ${r.avgElimRound.toFixed(1)}` : ""}`,
      9, "normal", DARK, 4
    );
  }
  y += GAP;

  // Player performance
  txt("Player Performance", 12, "bold", DARK);
  y += 2;
  for (const p of playerStats) {
    ensurePage(16);
    txt(p.name, 10, "bold", DARK, 4);
    const roles = Object.entries(p.roleBreakdown)
      .map(([r, c]) => `${ROLE_LABEL[r] ?? r}×${c}`)
      .join("  ");
    txt(
      `Win rate: ${Math.round(p.winRate * 100)}%  Survival: ${Math.round(p.survivalRate * 100)}%  Avg elim pos: ${p.avgElimPosition !== null ? p.avgElimPosition.toFixed(1) : "never"}`,
      9, "normal", MID, 8
    );
    txt(`Roles — ${roles}`, 9, "normal", LIGHT, 8);
    if (p.timesFirstEliminated > 0)
      txt(`First eliminated: ${p.timesFirstEliminated}×`, 9, "normal", LIGHT, 8);
    y += 2;
  }
  y += GAP;

  // Per-game summary
  txt("Per-Game Summary", 12, "bold", DARK);
  y += 2;
  summaries.forEach((s, i) => {
    ensurePage(12);
    const label =
      s.winner === "village" ? "Village Wins" : s.winner === "mafia" ? "Mafia Wins" : "Tie";
    txt(`Game ${i + 1}: ${label}, ${s.roundsPlayed} rounds`, 10, "bold", DARK, 4);
    txt(`Elimination: ${s.eliminationOrder.join(" → ")}`, 9, "normal", MID, 8);
    y += 2;
  });

  doc.save(`mafia-metrics-${Date.now()}.pdf`);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  accent = "text-white",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3">
      <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      {sub && <p className="text-neutral-600 text-[11px] mt-0.5">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MetricsView({ summaries, totalGames }: Props) {
  const completed = summaries.length;
  const inProgress = totalGames - completed;

  const villageWins = summaries.filter((s) => s.winner === "village").length;
  const mafiaWins = summaries.filter((s) => s.winner === "mafia").length;
  const ties = summaries.filter((s) => s.winner === "tie").length;
  const avgRounds =
    completed > 0 ? summaries.reduce((sum, s) => sum + s.roundsPlayed, 0) / completed : 0;
  const minRounds = completed > 0 ? Math.min(...summaries.map((s) => s.roundsPlayed)) : 0;
  const maxRounds = completed > 0 ? Math.max(...summaries.map((s) => s.roundsPlayed)) : 0;

  const playerStats = computePlayerStats(summaries);
  const roleStats = computeRoleStats(summaries);

  const villageRate = completed > 0 ? villageWins / completed : 0;
  const mafiaRate = completed > 0 ? mafiaWins / completed : 0;
  const tieRate = completed > 0 ? ties / completed : 0;

  const handleDownloadJSON = useCallback(
    () => downloadJSON(summaries, totalGames),
    [summaries, totalGames]
  );
  const handleDownloadPDF = useCallback(
    () => downloadPDF(summaries, totalGames),
    [summaries, totalGames]
  );

  if (completed === 0) {
    return (
      <div className="h-full bg-neutral-950 flex items-center justify-center flex-col gap-2">
        <p className="text-neutral-500 text-sm">No games completed yet.</p>
        {inProgress > 0 && (
          <p className="text-neutral-600 text-xs">
            {inProgress} game{inProgress > 1 ? "s" : ""} still running…
          </p>
        )}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full bg-neutral-950">
      <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-white font-semibold text-lg tracking-tight">Comprehensive Metrics</h2>
            <p className="text-neutral-500 text-xs mt-0.5">
              {completed} game{completed !== 1 ? "s" : ""} completed
              {inProgress > 0 ? `, ${inProgress} still running` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadJSON}
              className="h-7 text-xs border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              Save JSON
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadPDF}
              className="h-7 text-xs border-neutral-700 bg-neutral-900 text-neutral-300 hover:bg-neutral-800 hover:text-white"
            >
              Save PDF
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Completed" value={String(completed)} sub={inProgress > 0 ? `${inProgress} running` : "all done"} />
          <StatCard label="Village Wins" value={String(villageWins)} sub={`${Math.round(villageRate * 100)}%`} accent="text-emerald-400" />
          <StatCard label="Mafia Wins" value={String(mafiaWins)} sub={`${Math.round(mafiaRate * 100)}%`} accent="text-rose-400" />
          <StatCard label="Avg Rounds" value={avgRounds.toFixed(1)} sub={`${minRounds}–${maxRounds} range`} />
        </div>

        {/* Win distribution bar */}
        <div>
          <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-3">Win Distribution</p>
          <div className="flex rounded-md overflow-hidden h-8 text-xs font-semibold">
            {villageWins > 0 && (
              <div
                className="bg-emerald-900/80 border-r border-emerald-800 flex items-center justify-center text-emerald-300"
                style={{ width: `${villageRate * 100}%` }}
              >
                {Math.round(villageRate * 100)}% Village
              </div>
            )}
            {mafiaWins > 0 && (
              <div
                className="bg-rose-900/80 border-r border-rose-800 flex items-center justify-center text-rose-300"
                style={{ width: `${mafiaRate * 100}%` }}
              >
                {Math.round(mafiaRate * 100)}% Mafia
              </div>
            )}
            {ties > 0 && (
              <div
                className="bg-neutral-700 flex items-center justify-center text-neutral-300"
                style={{ width: `${tieRate * 100}%` }}
              >
                {Math.round(tieRate * 100)}% Tie
              </div>
            )}
          </div>
        </div>

        {/* Player performance table */}
        <div>
          <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-3">Player Performance</p>
          <div className="border border-neutral-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80">
                  <th className="text-left px-3 py-2.5 text-neutral-500 font-medium">#</th>
                  <th className="text-left px-3 py-2.5 text-neutral-500 font-medium">Player</th>
                  <th className="text-center px-3 py-2.5 text-neutral-500 font-medium">Games</th>
                  <th className="text-left px-3 py-2.5 text-neutral-500 font-medium">Roles</th>
                  <th className="text-center px-3 py-2.5 text-neutral-500 font-medium">Wins</th>
                  <th className="text-center px-3 py-2.5 text-neutral-500 font-medium">Win %</th>
                  <th className="text-center px-3 py-2.5 text-neutral-500 font-medium">Survive %</th>
                  <th className="text-center px-3 py-2.5 text-neutral-500 font-medium">Avg Elim</th>
                  <th className="text-center px-3 py-2.5 text-neutral-500 font-medium">1st Out</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((p, i) => (
                  <tr
                    key={p.name}
                    className={`border-b border-neutral-800/40 ${i % 2 === 0 ? "bg-neutral-950" : "bg-neutral-900/20"}`}
                  >
                    <td className="px-3 py-2 text-neutral-600">{i + 1}</td>
                    <td className="px-3 py-2 text-white font-medium">{p.name}</td>
                    <td className="px-3 py-2 text-neutral-400 text-center">{p.games}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {Object.entries(p.roleBreakdown).map(([role, count]) => (
                          <span key={role} className={`${ROLE_COLOR[role] ?? "text-neutral-400"}`}>
                            {ROLE_LABEL[role] ?? role}×{count}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-neutral-300 text-center">{p.wins}</td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`font-semibold ${
                          p.winRate >= 0.6
                            ? "text-emerald-400"
                            : p.winRate <= 0.35
                            ? "text-rose-400"
                            : "text-neutral-200"
                        }`}
                      >
                        {Math.round(p.winRate * 100)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neutral-400 text-center">
                      {Math.round(p.survivalRate * 100)}%
                    </td>
                    <td className="px-3 py-2 text-neutral-400 text-center">
                      {p.avgElimPosition !== null ? p.avgElimPosition.toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {p.timesFirstEliminated > 0 ? (
                        <span className="text-rose-400">{p.timesFirstEliminated}×</span>
                      ) : (
                        <span className="text-neutral-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-neutral-700 text-[10px] mt-1.5">
            Ranked by win rate. Win % = was on the winning team. Avg Elim = average elimination position (1 = first out).
          </p>
        </div>

        {/* Role analysis */}
        <div>
          <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-3">Role Analysis</p>
          <div className="grid grid-cols-4 gap-3">
            {roleStats.map((r) => (
              <div key={r.role} className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
                <p className={`font-semibold text-sm mb-2 ${ROLE_COLOR[r.role]}`}>
                  {ROLE_LABEL[r.role]}
                </p>
                <div className="flex flex-col gap-1 text-xs text-neutral-400">
                  <div className="flex justify-between">
                    <span>Appearances</span>
                    <span className="text-neutral-300">{r.appearances}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Win rate</span>
                    <span
                      className={`font-semibold ${
                        r.winRate >= 0.6 ? "text-emerald-400" : r.winRate <= 0.35 ? "text-rose-400" : "text-neutral-300"
                      }`}
                    >
                      {Math.round(r.winRate * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Survived</span>
                    <span className="text-neutral-300">
                      {r.survivals}/{r.appearances}
                    </span>
                  </div>
                  {r.avgElimRound !== null && (
                    <div className="flex justify-between">
                      <span>Avg elim round</span>
                      <span className="text-neutral-300">{r.avgElimRound.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Most targeted (earliest avg elimination) */}
        <div>
          <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-3">
            Targeting — Earliest Eliminated
          </p>
          <div className="flex flex-wrap gap-2">
            {[...playerStats]
              .filter((p) => p.avgElimPosition !== null)
              .sort((a, b) => (a.avgElimPosition ?? 99) - (b.avgElimPosition ?? 99))
              .map((p) => (
                <div
                  key={p.name}
                  className="bg-neutral-900 border border-neutral-800 rounded-md px-3 py-1.5 flex items-center gap-2"
                >
                  <span className="text-white text-xs font-medium">{p.name}</span>
                  <span className="text-neutral-500 text-xs">pos {p.avgElimPosition!.toFixed(1)}</span>
                  {p.timesFirstEliminated > 0 && (
                    <span className="text-rose-400 text-[10px]">1st×{p.timesFirstEliminated}</span>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Per-game summary */}
        <div>
          <p className="text-neutral-500 text-[11px] uppercase tracking-widest font-medium mb-3">Per-Game Summary</p>
          <div className="border border-neutral-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/80">
                  <th className="text-left px-3 py-2.5 text-neutral-500 font-medium">Game</th>
                  <th className="text-left px-3 py-2.5 text-neutral-500 font-medium">Result</th>
                  <th className="text-center px-3 py-2.5 text-neutral-500 font-medium">Rounds</th>
                  <th className="text-left px-3 py-2.5 text-neutral-500 font-medium">Elimination Order</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s, i) => {
                  const cfg =
                    s.winner === "village"
                      ? { label: "Village Wins", cls: "text-emerald-400" }
                      : s.winner === "mafia"
                      ? { label: "Mafia Wins", cls: "text-rose-400" }
                      : { label: "Tie", cls: "text-neutral-400" };
                  return (
                    <tr
                      key={s.gameId}
                      className={`border-b border-neutral-800/40 ${i % 2 === 0 ? "bg-neutral-950" : "bg-neutral-900/20"}`}
                    >
                      <td className="px-3 py-2 text-neutral-500">{i + 1}</td>
                      <td className={`px-3 py-2 font-semibold ${cfg.cls}`}>{cfg.label}</td>
                      <td className="px-3 py-2 text-neutral-400 text-center">{s.roundsPlayed}</td>
                      <td className="px-3 py-2 text-neutral-500 leading-relaxed">
                        {s.eliminationOrder.join(" → ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </ScrollArea>
  );
}
