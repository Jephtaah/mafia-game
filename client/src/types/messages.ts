export interface PlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
  isAlive: boolean;
  connected: boolean;
}

export type ServerMessage =
  | { type: "room_created"; code: string; playerId: string; token: string; players: PlayerInfo[]; isHost: boolean }
  | { type: "player_list"; players: PlayerInfo[] }
  | { type: "error"; message: string }
  | { type: "role_reveal"; role: string; fellowImpostors?: PlayerInfo[]; timer: number }
  | { type: "phase_change"; phase: string; timer: number }
  | { type: "night_status"; voted?: string[]; waiting?: boolean }
  | { type: "resolution"; eliminated: string | null; role: string | null }
  | { type: "chat_message"; playerId: string; name: string; text: string }
  | { type: "vote_tally"; votes: { playerId: string; target: string }[] }
  | { type: "elimination"; eliminated: string | null; role: string | null }
  | { type: "game_over"; winner: string; players: { id: string; name: string; role: string; isAlive: boolean }[] }
  | { type: "resume_state"; phase: string; timer: number; role?: string; fellowImpostors?: PlayerInfo[]; isAlive: boolean; playerId: string; players: PlayerInfo[]; eliminated?: string | null; eliminatedRole?: string | null; voted?: string[]; waiting?: boolean; votes?: { playerId: string; target: string }[] }
  | { type: "player_disconnected"; playerId: string }
  | { type: "player_reconnected"; playerId: string };

export type ClientMessage =
  | { type: "create_room"; name: string; nightSeconds?: number; daySeconds?: number; voteSeconds?: number }
  | { type: "join_room"; code: string; name: string }
  | { type: "start_game" }
  | { type: "night_kill"; target: string }
  | { type: "chat"; text: string }
  | { type: "vote"; target: string }
  | { type: "reconnect"; token: string };