export type MultiplayerMode = "private" | "ranked" | "bot";
export type MatchStatus = "countdown" | "active" | "finished";
export type RoomStatus = "lobby" | "countdown" | "inMatch" | "closed";

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
  jump?: boolean;
  reload?: boolean;
}

export type PlayerAnimationState =
  "idle" | "run" | "jump" | "fall" | "fire" | "reload" | "hit" | "death";
export type PlayerLifeState = "alive" | "dying" | "defeated";

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
  velocityX: number;
  velocityY: number;
  facing: -1 | 1;
  grounded: boolean;
  weaponId: string;
  magazine: number;
  reserveAmmo: number;
  reloadingUntil?: number;
  animationState: PlayerAnimationState;
  lifeState: PlayerLifeState;
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
  draw?: boolean;
  serverTick: number;
  lastTickAt: number;
  timeoutAt: number;
  scenarioVersion: string;
  damageEvents: AuthoritativeDamageEvent[];
  players: MatchPlayerState[];
}

export interface AuthoritativeDamageEvent {
  actionId: string;
  serverTick: number;
  attackerId: string;
  targetId: string;
  hitRegion: "head" | "torso";
  damage: number;
  targetHealth: number;
}

export interface QueueEntry {
  playerId: string;
  displayName: string;
  rating: number;
  socketId?: string;
  joinedAt: number;
}
