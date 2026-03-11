"use client";

import { useReducer, useCallback } from "react";
import { SSEEvent, GameUIState, initialGameState } from "@/lib/types";

type Action =
  | { type: "RESET" }
  | { type: "SET_GAME_ID"; gameId: string }
  | { type: "SSE_EVENT"; event: SSEEvent }
  | { type: "SET_STATUS"; status: GameUIState["status"]; error?: string };

function addToRound<T>(
  map: Record<number, T[]>,
  round: number,
  item: T
): Record<number, T[]> {
  const existing = map[round] ?? [];
  return { ...map, [round]: [...existing, item] };
}

function ensureRound<T>(
  map: Record<number, T[]>,
  round: number
): Record<number, T[]> {
  if (map[round]) return map;
  return { ...map, [round]: [] };
}

function addRound(rounds: number[], rn: number): number[] {
  return rounds.includes(rn) ? rounds : [...rounds, rn];
}

function reducer(state: GameUIState, action: Action): GameUIState {
  switch (action.type) {
    case "RESET":
      return { ...initialGameState };

    case "SET_GAME_ID":
      return { ...state, gameId: action.gameId, status: "running" };

    case "SET_STATUS":
      return { ...state, status: action.status, error: action.error ?? null };

    case "SSE_EVENT": {
      const ev = action.event;

      switch (ev.type) {
        case "game_init": {
          const aliveSet = new Set(ev.players.map((p) => p.name));
          return { ...state, players: ev.players, alivePlayers: aliveSet };
        }

        case "phase_change": {
          const rn = ev.round_number ?? state.roundNumber;
          const next: Partial<GameUIState> = {
            phase: ev.phase,
            roundNumber: rn,
            rounds: addRound(state.rounds, rn),
          };

          if (ev.phase === "night") {
            next.votes = [];
            next.trialSuspect = null;
            next.trialVotes = 0;
            next.defenseSpeech = null;
            next.nightLogByRound = ensureRound(state.nightLogByRound, rn);
          }
          if (ev.phase === "day") {
            next.votes = [];
            next.chatByRound = ensureRound(state.chatByRound, rn);
          }
          return { ...state, ...next };
        }

        case "night_action": {
          const rn = ev.round_number ?? state.roundNumber;
          const entry = ev.message ?? `${ev.actor_role}: ${ev.target ?? ""}`;
          return {
            ...state,
            nightLogByRound: addToRound(state.nightLogByRound, rn, entry),
          };
        }

        case "night_resolved": {
          const rn = ev.round_number ?? state.roundNumber;
          let log = state.nightLogByRound[rn] ?? [];
          if (ev.eliminated) log = [...log, `${ev.eliminated} was eliminated`];
          else if (ev.saved) log = [...log, `${ev.saved} was saved — no one died`];

          const aliveSet = new Set(state.alivePlayers);
          if (ev.eliminated) aliveSet.delete(ev.eliminated);

          return {
            ...state,
            nightLogByRound: { ...state.nightLogByRound, [rn]: log },
            alivePlayers: aliveSet,
          };
        }

        case "chat_message": {
          const rn = ev.round_number ?? state.roundNumber;
          const entry = {
            player_name: ev.player_name,
            message: ev.message,
            round_number: rn,
          };
          return {
            ...state,
            chatByRound: addToRound(state.chatByRound, rn, entry),
          };
        }

        case "vote_cast": {
          const newVote = {
            voter: ev.voter,
            voter_role: ev.voter_role,
            target: ev.target,
            reason: ev.reason,
          };
          const existing = state.votes.filter((v) => v.voter !== ev.voter);
          return { ...state, votes: [...existing, newVote] };
        }

        case "trial_start": {
          return { ...state, trialSuspect: ev.suspect, trialVotes: ev.votes };
        }

        case "defense": {
          return { ...state, defenseSpeech: ev.defense };
        }

        case "elimination": {
          const rn = ev.round_number ?? state.roundNumber;
          const aliveSet = new Set(state.alivePlayers);
          aliveSet.delete(ev.player_name);
          return {
            ...state,
            alivePlayers: aliveSet,
            eliminationOrder: [...state.eliminationOrder, ev.player_name],
            eliminationByRound: addToRound(state.eliminationByRound, rn, ev.player_name),
          };
        }

        case "game_over": {
          return {
            ...state,
            winner: ev.winner,
            finalPlayerStates: ev.final_player_states ?? [],
            eliminationOrder: ev.elimination_order ?? state.eliminationOrder,
            phase: "game_over",
            status: "finished",
          };
        }

        case "error": {
          return { ...state, status: "error", error: ev.message };
        }

        case "raw_log": {
          return { ...state, rawLogs: [...state.rawLogs, ev.message] };
        }

        default:
          return state;
      }
    }

    default:
      return state;
  }
}

export function useGameState() {
  const [state, dispatch] = useReducer(reducer, initialGameState);

  const handleEvent = useCallback((event: SSEEvent) => {
    dispatch({ type: "SSE_EVENT", event });
  }, []);

  const setGameId = useCallback((gameId: string) => {
    dispatch({ type: "SET_GAME_ID", gameId });
  }, []);

  const setStatus = useCallback(
    (status: GameUIState["status"], error?: string) => {
      dispatch({ type: "SET_STATUS", status, error });
    },
    []
  );

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return { state, handleEvent, setGameId, setStatus, reset };
}
