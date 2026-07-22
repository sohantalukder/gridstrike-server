export type MultiplayerMode = 'private' | 'ranked' | 'bot';
export type MatchStatus = 'countdown' | 'active' | 'finished';
export type RoomStatus = 'lobby' | 'countdown' | 'inMatch' | 'closed';

export interface RoomPlayer {
  playerId: string;
  displayName: string;
  ready: boolean;
  connected: boolean;
  socketId?: string;
  loadoutId?: string;
}

export interface MultiplayerRoom {
  id: string;
  code: string;
  status: RoomStatus;
  players: RoomPlayer[];
  hostPlayerId: string;
  matchId?: string;
  createdAt: string;
}

export interface PlayerIntent {
  movement?: { x?: number; y?: number };
  aim?: { x?: number; y?: number };
  isFiring?: boolean;
}

export interface MatchPlayerState {
  playerId: string;
  displayName: string;
  x: number;
  y: number;
  aimX: number;
  aimY: number;
  health: number;
  score: number;
  kills: number;
  sequence: number;
  connected: boolean;
  bot: boolean;
  lastFireAt: number;
  socketId?: string;
  disconnectedAt?: number;
}

export interface MultiplayerMatch {
  id: string;
  mode: MultiplayerMode;
  status: MatchStatus;
  roomId?: string;
  botMatch: boolean;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  winnerId?: string;
  players: MatchPlayerState[];
}

export interface QueueEntry {
  playerId: string;
  displayName: string;
  rating: number;
  socketId?: string;
  joinedAt: number;
}
