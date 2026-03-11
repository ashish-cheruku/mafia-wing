// SSE event shapes emitted by the Python backend

export type SSEEvent =
  | { type: "game_init"; game_id: string; players: PlayerInfo[] }
  | { type: "phase_change"; phase: Phase; round_number?: number; suspect?: string }
  | { type: "night_action"; actor_role: string; actor?: string; target?: string; result?: string; reason?: string; message?: string; round_number?: number }
  | { type: "night_resolved"; eliminated: string | null; saved: string | null; message?: string; round_number?: number }
  | { type: "chat_message"; player_name: string; message: string; round_number?: number }
  | { type: "vote_cast"; voter: string; voter_role: string; target: string; reason: string; round_number?: number }
  | { type: "trial_start"; suspect: string; votes: number; suspect_role: string; round_number?: number }
  | { type: "defense"; suspect: string; suspect_role: string; defense: string; round_number?: number }
  | { type: "elimination"; player_name: string; role: string; phase: string; round_number?: number }
  | { type: "vote_tied"; message: string }
  | { type: "game_over"; winner: string; final_player_states?: PlayerFinalState[]; elimination_order?: string[] }
  | { type: "game_setup" }
  | { type: "raw_log"; message: string }
  | { type: "error"; message: string };

export type Phase =
  | "night"
  | "day"
  | "voting"
  | "defense"
  | "final_voting"
  | "game_over";

export type RoleType = "mafia" | "doctor" | "detective" | "villager";

export interface PlayerInfo {
  name: string;
  role: RoleType;
  personality: string;
}

export interface PlayerFinalState {
  name: string;
  role: RoleType;
  is_alive: boolean;
}

export interface ChatEntry {
  player_name: string;
  message: string;
  round_number: number;
}

export interface VoteEntry {
  voter: string;
  voter_role: string;
  target: string;
  reason: string;
}

export interface GameUIState {
  gameId: string | null;
  phase: Phase | null;
  roundNumber: number;
  rounds: number[];
  players: PlayerInfo[];
  alivePlayers: Set<string>;
  eliminationOrder: string[];
  // Per-round storage
  chatByRound: Record<number, ChatEntry[]>;
  nightLogByRound: Record<number, string[]>;
  eliminationByRound: Record<number, string[]>;
  // Voting state (current round)
  votes: VoteEntry[];
  trialSuspect: string | null;
  trialVotes: number;
  defenseSpeech: string | null;
  // Game over
  winner: string | null;
  finalPlayerStates: PlayerFinalState[];
  status: "idle" | "running" | "finished" | "error";
  error: string | null;
  rawLogs: string[];
}

export const initialGameState: GameUIState = {
  gameId: null,
  phase: null,
  roundNumber: 1,
  rounds: [],
  players: [],
  alivePlayers: new Set(),
  eliminationOrder: [],
  chatByRound: {},
  nightLogByRound: {},
  eliminationByRound: {},
  votes: [],
  trialSuspect: null,
  trialVotes: 0,
  defenseSpeech: null,
  winner: null,
  finalPlayerStates: [],
  status: "idle",
  error: null,
  rawLogs: [],
};
