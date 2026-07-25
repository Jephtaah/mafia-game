export interface PlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
}

export type ServerMessage =
  | { type: "room_created"; code: string; playerId: string; players: PlayerInfo[]; isHost: boolean }
  | { type: "player_list"; players: PlayerInfo[] }
  | { type: "error"; message: string }
  | { type: "role_reveal"; role: string; fellowImpostors?: PlayerInfo[] }
  | { type: "phase_change"; phase: string; timer: number }
  | { type: "night_status"; voted?: string[]; waiting?: boolean }
  | { type: "resolution"; eliminated: string | null; role: string | null }
  | { type: "chat_message"; playerId: string; name: string; text: string }
  | { type: "vote_tally"; votes: { playerId: string; target: string }[] }
  | { type: "elimination"; eliminated: string | null; role: string | null }
  | { type: "game_over"; winner: string };

export type ClientMessage =
  | { type: "create_room"; name: string }
  | { type: "join_room"; code: string; name: string }
  | { type: "start_game" }
  | { type: "night_kill"; target: string }
  | { type: "chat"; text: string }
  | { type: "vote"; target: string };