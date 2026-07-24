import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../infrastructure/database/prisma.service";
import { RedisService } from "../../infrastructure/redis/redis.service";
import {
  MatchPlayerState,
  MultiplayerMatch,
  MultiplayerRoom,
  PlayerIntent,
  QueueEntry,
} from "./multiplayer.types";

@Injectable()
export class MultiplayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  static readonly simulationHz = 60;
  static readonly snapshotHz = 20;
  static readonly matchTimeoutMs = 180_000;
  static readonly reconnectLeaseMs = 30_000;
  static readonly acceleration = 1800;
  static readonly friction = 1400;
  static readonly maximumSpeed = 285;
  static readonly gravity = 1650;
  static readonly jumpVelocity = -620;

  private readonly rooms = new Map<string, MultiplayerRoom>();
  private readonly roomsByCode = new Map<string, string>();
  private readonly rankedQueue = new Map<string, QueueEntry>();
  private readonly matches = new Map<string, MultiplayerMatch>();
  private readonly reconnectTokens = new Map<
    string,
    { playerId: string; matchId: string; expiresAt: number }
  >();
  private readonly playerIntents = new Map<string, PlayerIntent>();
  private readonly processedActions = new Map<string, Set<string>>();
  private readonly activeMatchByPlayer = new Map<string, string>();

  async playerName(playerId: string) {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId: playerId },
    });
    return profile?.displayName ?? `STRIKER-${playerId.slice(0, 5)}`;
  }

  async createRoom(playerId: string) {
    const displayName = await this.playerName(playerId);
    const room: MultiplayerRoom = {
      id: randomUUID(),
      code: this.createCode(),
      status: "lobby",
      hostPlayerId: playerId,
      createdAt: new Date().toISOString(),
      players: [{ playerId, displayName, ready: false, connected: false }],
    };
    this.rooms.set(room.id, room);
    this.roomsByCode.set(room.code, room.id);
    return room;
  }

  async joinRoom(playerId: string, code: string) {
    const room = this.getRoomByCode(code);
    if (!room || room.status === "closed") return null;
    const displayName = await this.playerName(playerId);
    if (!room.players.some((player) => player.playerId === playerId)) {
      room.players.push({
        playerId,
        displayName,
        ready: false,
        connected: false,
      });
    }
    return room;
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId) ?? null;
  }

  getRoomByCode(code: string) {
    const roomId = this.roomsByCode.get(code.toUpperCase());
    return roomId ? this.getRoom(roomId) : null;
  }

  leaveRoom(playerId: string, roomId: string) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    room.players = room.players.filter(
      (player) => player.playerId !== playerId,
    );
    if (room.players.length === 0 || room.hostPlayerId === playerId) {
      room.status = "closed";
      this.roomsByCode.delete(room.code);
    }
    return room;
  }

  markSocket(playerId: string, socketId: string) {
    for (const room of this.rooms.values()) {
      const player = room.players.find((item) => item.playerId === playerId);
      if (player) {
        player.socketId = socketId;
        player.connected = true;
      }
    }
    for (const match of this.matches.values()) {
      const player = match.players.find((item) => item.playerId === playerId);
      if (player) {
        player.connected = true;
        player.disconnectedAt = undefined;
        player.socketId = socketId;
      }
    }
  }

  disconnectSocket(socketId: string) {
    const now = Date.now();
    const affectedMatches: MultiplayerMatch[] = [];
    for (const room of this.rooms.values()) {
      for (const player of room.players) {
        if (player.socketId === socketId) {
          player.connected = false;
          player.socketId = undefined;
        }
      }
    }
    for (const match of this.matches.values()) {
      for (const player of match.players) {
        if (!player.bot && player.connected && player.socketId === socketId) {
          player.connected = false;
          player.disconnectedAt = now;
          player.socketId = undefined;
          affectedMatches.push(match);
        }
      }
    }
    return affectedMatches;
  }

  setReady(
    playerId: string,
    roomId: string,
    ready: boolean,
    loadoutId?: string,
  ) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== "lobby") return null;
    const player = room.players.find((item) => item.playerId === playerId);
    if (!player) return null;
    player.ready = ready;
    player.loadoutId = loadoutId ?? player.loadoutId;
    return room;
  }

  canStartRoom(room: MultiplayerRoom) {
    return (
      room.status === "lobby" &&
      room.players.length >= 2 &&
      room.players.every((player) => player.ready)
    );
  }

  startRoomMatch(roomId: string) {
    const room = this.getRoom(roomId);
    if (!room || !this.canStartRoom(room)) return null;
    const match = this.createMatch("private", room.players, room.id, false);
    room.status = "countdown";
    room.matchId = match.id;
    return match;
  }

  async joinRanked(playerId: string, socketId?: string) {
    const activeMatchId = this.activeMatchByPlayer.get(playerId);
    if (activeMatchId) {
      const active = this.getMatch(activeMatchId);
      if (active && active.status !== "finished") {
        return { queued: false, match: active };
      }
      this.activeMatchByPlayer.delete(playerId);
    }
    const displayName = await this.playerName(playerId);
    const entry: QueueEntry = {
      playerId,
      displayName,
      rating: 1000,
      socketId,
      joinedAt: Date.now(),
    };
    const opponent = [...this.rankedQueue.values()].find(
      (item) => item.playerId !== playerId,
    );
    if (opponent) {
      this.rankedQueue.delete(opponent.playerId);
      const match = this.createMatch(
        "ranked",
        [
          { playerId, displayName, socketId },
          {
            playerId: opponent.playerId,
            displayName: opponent.displayName,
            socketId: opponent.socketId,
          },
        ],
        undefined,
        false,
      );
      return { queued: false, match };
    }
    this.rankedQueue.set(playerId, entry);
    if (this.config.get("NODE_ENV") === "development") {
      const match = this.createMatch(
        "bot",
        [
          { playerId, displayName, socketId },
          { playerId: "bot-opponent", displayName: "DEV_BOT" },
        ],
        undefined,
        true,
      );
      this.rankedQueue.delete(playerId);
      return { queued: false, match };
    }
    return { queued: true, entry };
  }

  cancelRanked(playerId: string) {
    return this.rankedQueue.delete(playerId);
  }

  getMatch(matchId: string) {
    return this.matches.get(matchId) ?? null;
  }

  listMatches(playerId: string) {
    return [...this.matches.values()].filter((match) =>
      match.players.some((player) => player.playerId === playerId),
    );
  }

  markLoaded(matchId: string) {
    const match = this.getMatch(matchId);
    if (!match || match.status === "finished") return null;
    match.status = "active";
    match.startedAt = match.startedAt ?? Date.now();
    match.timeoutAt = match.startedAt + MultiplayerService.matchTimeoutMs;
    return match;
  }

  applyInput(
    matchId: string,
    playerId: string,
    actionId: string,
    sequence: number,
    intent: PlayerIntent,
  ) {
    const match = this.getMatch(matchId);
    if (!match || match.status === "finished")
      return { accepted: false, reason: "match-unavailable" };
    const player = match.players.find((item) => item.playerId === playerId);
    if (!player || player.health <= 0)
      return { accepted: false, reason: "player-unavailable" };
    if (sequence <= player.sequence)
      return { accepted: false, reason: "duplicate-sequence" };
    const processed = this.processedActions.get(match.id) ?? new Set<string>();
    this.processedActions.set(match.id, processed);
    if (!actionId || processed.has(actionId)) {
      return { accepted: false, reason: "duplicate-action" };
    }
    processed.add(actionId);
    if (processed.size > 512) {
      const oldest = processed.values().next().value as string | undefined;
      if (oldest) processed.delete(oldest);
    }

    player.sequence = sequence;
    const aim = this.normalizeVector(
      intent.aim?.x ?? player.aimX,
      intent.aim?.y ?? player.aimY,
    );
    player.aimX = aim.x;
    player.aimY = aim.y;
    this.playerIntents.set(`${match.id}:${playerId}`, {
      movement: { x: this.clamp(intent.movement?.x ?? 0, -1, 1), y: 0 },
      aim,
      isFiring: intent.isFiring === true,
      jump: intent.jump === true,
      reload: intent.reload === true,
    });
    if (intent.isFiring) this.applyFire(match, player, actionId);
    if (intent.reload) this.startReload(player, Date.now());
    return { accepted: true, actionId, match };
  }

  tickAll(now = Date.now()) {
    const changed: MultiplayerMatch[] = [];
    for (const match of this.matches.values()) {
      if (match.status !== "active") continue;
      this.tickMatch(match, now);
      changed.push(match);
    }
    return changed;
  }

  private tickMatch(match: MultiplayerMatch, now: number) {
    const dt = 1 / MultiplayerService.simulationHz;
    match.serverTick += 1;
    match.lastTickAt = now;
    for (const player of match.players) {
      if (player.health <= 0) continue;
      if (
        !player.connected &&
        player.disconnectedAt &&
        now - player.disconnectedAt >= MultiplayerService.reconnectLeaseMs
      ) {
        player.health = 0;
        player.lifeState = "defeated";
        player.animationState = "death";
        continue;
      }
      if (player.reloadingUntil && now >= player.reloadingUntil) {
        const loaded = Math.min(24 - player.magazine, player.reserveAmmo);
        player.magazine += loaded;
        player.reserveAmmo -= loaded;
        player.reloadingUntil = undefined;
      }
      const intent = this.playerIntents.get(`${match.id}:${player.playerId}`);
      const moveX = this.clamp(intent?.movement?.x ?? 0, -1, 1);
      if (Math.abs(moveX) > 0.08) {
        player.facing = moveX >= 0 ? 1 : -1;
        player.velocityX += moveX * MultiplayerService.acceleration * dt;
      } else {
        const drag = MultiplayerService.friction * dt;
        player.velocityX =
          Math.abs(player.velocityX) <= drag
            ? 0
            : player.velocityX - Math.sign(player.velocityX) * drag;
      }
      player.velocityX = this.clamp(
        player.velocityX,
        -MultiplayerService.maximumSpeed,
        MultiplayerService.maximumSpeed,
      );
      if (intent?.jump && player.grounded) {
        player.velocityY = MultiplayerService.jumpVelocity;
        player.grounded = false;
        intent.jump = false;
      }
      player.velocityY = this.clamp(
        player.velocityY + MultiplayerService.gravity * dt,
        -900,
        980,
      );
      player.x = this.clamp(player.x + player.velocityX * dt, 24, 776);
      player.y = Math.max(0, player.y - player.velocityY * dt);
      if (player.y <= 0 && player.velocityY >= 0) {
        player.y = 0;
        player.velocityY = 0;
        player.grounded = true;
      }
      player.animationState = player.reloadingUntil
        ? "reload"
        : !player.grounded
          ? player.velocityY < 0
            ? "jump"
            : "fall"
          : Math.abs(player.velocityX) > 1
            ? "run"
            : "idle";
    }
    this.updateBot(match);
    this.finishIfNeeded(match, now);
    // Redis is the recovery store, not the 60 Hz simulation loop. Persist at
    // snapshot cadence so an active duel cannot generate 60 writes/second.
    if (match.serverTick % 3 === 0 || match.status === "finished") {
      void this.persistLiveMatch(match);
    }
  }

  surrender(matchId: string, playerId: string) {
    const match = this.getMatch(matchId);
    if (!match || match.status === "finished") return null;
    const other = match.players.find((player) => player.playerId !== playerId);
    match.status = "finished";
    match.finishedAt = Date.now();
    match.winnerId = other?.playerId;
    this.completeMatch(match);
    return match;
  }

  reconnectToken(playerId: string, matchId: string) {
    const token = randomUUID();
    const session = {
      playerId,
      matchId,
      expiresAt: Date.now() + MultiplayerService.reconnectLeaseMs,
    };
    this.reconnectTokens.set(token, session);
    void this.redis.setJson(`multiplayer:reconnect:${token}`, session, 30);
    return token;
  }

  async recoverMatch(token: string) {
    const session =
      this.reconnectTokens.get(token) ??
      (await this.redis.getJson<{
        playerId: string;
        matchId: string;
        expiresAt: number;
      }>(`multiplayer:reconnect:${token}`));
    if (!session || session.expiresAt < Date.now()) return null;
    return (
      this.getMatch(session.matchId) ??
      (await this.redis.getJson<MultiplayerMatch>(
        `multiplayer:match:${session.matchId}`,
      ))
    );
  }

  snapshot(match: MultiplayerMatch) {
    return {
      matchId: match.id,
      mode: match.mode,
      status: match.status,
      botMatch: match.botMatch,
      serverTime: Date.now(),
      serverTick: match.serverTick,
      scenarioVersion: match.scenarioVersion,
      timeoutAt: match.timeoutAt,
      draw: match.draw ?? false,
      damageEvents: match.damageEvents,
      winnerId: match.winnerId,
      players: match.players,
    };
  }

  private createMatch(
    mode: "private" | "ranked" | "bot",
    players: Array<{
      playerId: string;
      displayName: string;
      socketId?: string;
    }>,
    roomId?: string,
    botMatch = false,
  ) {
    const now = Date.now();
    const match: MultiplayerMatch = {
      id: randomUUID(),
      mode,
      roomId,
      status: "countdown",
      botMatch,
      createdAt: now,
      serverTick: 0,
      lastTickAt: now,
      timeoutAt: now + MultiplayerService.matchTimeoutMs,
      scenarioVersion: "urban-loop@4",
      damageEvents: [],
      players: players.slice(0, 2).map((player, index) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        x: index === 0 ? 120 : 680,
        y: 0,
        aimX: index === 0 ? 1 : -1,
        aimY: 0,
        health: 100,
        score: 0,
        kills: 0,
        sequence: 0,
        velocityX: 0,
        velocityY: 0,
        facing: index === 0 ? 1 : -1,
        grounded: true,
        weaponId: "starter-rifle",
        magazine: 24,
        reserveAmmo: 120,
        animationState: "idle",
        lifeState: "alive",
        connected: true,
        bot: player.playerId.startsWith("bot-"),
        lastFireAt: 0,
        socketId: player.socketId,
      })),
    };
    this.matches.set(match.id, match);
    this.processedActions.set(match.id, new Set());
    for (const player of match.players) {
      this.activeMatchByPlayer.set(player.playerId, match.id);
      void this.redis.setIfAbsent(
        `multiplayer:active:${player.playerId}`,
        match.id,
        240,
      );
    }
    void this.persistLiveMatch(match);
    void this.persistMatchCreated(match);
    return match;
  }

  private applyFire(
    match: MultiplayerMatch,
    player: MatchPlayerState,
    actionId: string,
  ) {
    const now = Date.now();
    if (
      now - player.lastFireAt < 220 ||
      player.reloadingUntil ||
      player.magazine <= 0
    ) {
      if (player.magazine <= 0) this.startReload(player, now);
      return;
    }
    player.lastFireAt = now;
    player.magazine -= 1;
    player.animationState = "fire";
    const target = match.players.find(
      (item) => item.playerId !== player.playerId && item.health > 0,
    );
    if (!target) return;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = Math.hypot(dx, dy);
    const aimDot =
      distance === 0
        ? 1
        : (dx / distance) * player.aimX + (dy / distance) * player.aimY;
    const facingTarget = dx * player.facing >= 0;
    const hasLineOfSight = Math.abs(dy) <= 70;
    if (distance <= 760 && aimDot > 0.35 && facingTarget && hasLineOfSight) {
      target.health = this.clamp(target.health - 12, 0, 100);
      player.score += 120;
      target.animationState = target.health <= 0 ? "death" : "hit";
      target.lifeState = target.health <= 0 ? "defeated" : "alive";
      match.damageEvents.push({
        actionId,
        serverTick: match.serverTick,
        attackerId: player.playerId,
        targetId: target.playerId,
        hitRegion: "torso",
        damage: 12,
        targetHealth: target.health,
      });
      if (match.damageEvents.length > 32) match.damageEvents.shift();
      if (target.health <= 0) player.kills += 1;
    }
  }

  private startReload(player: MatchPlayerState, now: number) {
    if (
      player.reloadingUntil ||
      player.magazine >= 24 ||
      player.reserveAmmo <= 0
    )
      return;
    player.reloadingUntil = now + 1350;
    player.animationState = "reload";
  }

  private updateBot(match: MultiplayerMatch) {
    const bot = match.players.find((player) => player.bot && player.health > 0);
    const target = match.players.find(
      (player) => !player.bot && player.health > 0,
    );
    if (!bot || !target || match.status === "finished") return;
    const movement = this.normalizeVector(target.x - bot.x, target.y - bot.y);
    bot.x = this.clamp(bot.x + movement.x * 8, 24, 776);
    bot.y = this.clamp(bot.y + movement.y * 8, 0, 426);
    bot.aimX = movement.x;
    bot.aimY = movement.y;
    this.applyFire(match, bot, `bot-${match.serverTick}-${bot.playerId}`);
  }

  private finishIfNeeded(match: MultiplayerMatch, now = Date.now()) {
    const alive = match.players.filter((player) => player.health > 0);
    if (alive.length <= 1 && match.status !== "finished") {
      match.status = "finished";
      match.finishedAt = now;
      match.winnerId = alive[0]?.playerId;
      this.completeMatch(match);
      return;
    }
    if (now >= match.timeoutAt && match.status !== "finished") {
      const ranked = [...match.players].sort(
        (a, b) => b.health - a.health || b.score - a.score,
      );
      const tied =
        ranked.length >= 2 &&
        ranked[0].health === ranked[1].health &&
        ranked[0].score === ranked[1].score;
      match.status = "finished";
      match.finishedAt = now;
      match.draw = tied;
      match.winnerId = tied ? undefined : ranked[0]?.playerId;
      this.completeMatch(match);
    }
  }

  private completeMatch(match: MultiplayerMatch) {
    for (const player of match.players) {
      this.activeMatchByPlayer.delete(player.playerId);
      this.playerIntents.delete(`${match.id}:${player.playerId}`);
      void this.redis.del(`multiplayer:active:${player.playerId}`);
    }
    this.processedActions.delete(match.id);
    void this.persistLiveMatch(match);
    void this.persistMatchFinished(match);
  }

  private async persistLiveMatch(match: MultiplayerMatch) {
    try {
      await this.redis.setJson(`multiplayer:match:${match.id}`, match, 240);
    } catch {
      // The in-memory tick remains authoritative during local Redis outages.
    }
  }

  private async persistMatchCreated(match: MultiplayerMatch) {
    try {
      await (this.prisma as any).multiplayerMatch.upsert({
        where: { id: match.id },
        update: {
          status: match.status,
          startedAt: match.startedAt ? new Date(match.startedAt) : undefined,
        },
        create: {
          id: match.id,
          mode: match.mode,
          status: match.status,
          roomId: match.roomId,
          botMatch: match.botMatch,
          createdAt: new Date(match.createdAt),
          startedAt: match.startedAt ? new Date(match.startedAt) : undefined,
        },
      });
      for (const player of match.players) {
        await (this.prisma as any).matchParticipant.upsert({
          where: {
            matchId_playerId: { matchId: match.id, playerId: player.playerId },
          },
          update: {
            health: player.health,
            score: player.score,
            kills: player.kills,
            connected: player.connected,
          },
          create: {
            matchId: match.id,
            playerId: player.playerId,
            displayName: player.displayName,
            health: player.health,
            score: player.score,
            kills: player.kills,
            connected: player.connected,
            bot: player.bot,
          },
        });
      }
    } catch {
      // Live matches continue even when persistence is unavailable in local development.
    }
  }

  private async persistMatchFinished(match: MultiplayerMatch) {
    try {
      await (this.prisma as any).multiplayerMatch.update({
        where: { id: match.id },
        data: {
          status: match.status,
          winnerId: match.winnerId,
          finishedAt: match.finishedAt
            ? new Date(match.finishedAt)
            : new Date(),
        },
      });
      for (const player of match.players) {
        await (this.prisma as any).matchParticipant.update({
          where: {
            matchId_playerId: { matchId: match.id, playerId: player.playerId },
          },
          data: {
            health: player.health,
            score: player.score,
            kills: player.kills,
            connected: player.connected,
          },
        });
        if (!player.bot) {
          await this.persistPlayerResult(match, player);
        }
      }
    } catch {
      // Result queues and live snapshots still protect the gameplay loop locally.
    }
  }

  private async persistPlayerResult(
    match: MultiplayerMatch,
    player: MatchPlayerState,
  ) {
    const profile = await this.prisma.playerProfile.findUnique({
      where: { userId: player.playerId },
    });
    if (!profile) return;
    const victory = match.winnerId === player.playerId;
    const durationSeconds = match.startedAt
      ? Math.max(
          0,
          Math.round(
            ((match.finishedAt ?? Date.now()) - match.startedAt) / 1000,
          ),
        )
      : 0;
    const coins = victory ? 120 : 40;
    const experience = victory ? 2450 : 900;
    await this.prisma.gameResult.upsert({
      where: { idempotencyKey: `multiplayer-${match.id}-${player.playerId}` },
      update: {},
      create: {
        playerProfileId: profile.id,
        idempotencyKey: `multiplayer-${match.id}-${player.playerId}`,
        mode: match.mode,
        status: victory ? "victory" : "defeat",
        score: player.score,
        kills: player.kills,
        durationSeconds,
        nodesCaptured: 0,
        damageTaken: 100 - player.health,
        coins,
        experience,
      },
    });
    await this.prisma.playerProfile.update({
      where: { id: profile.id },
      data: {
        coins: { increment: coins },
        experience: { increment: experience },
        totalGames: { increment: 1 },
        totalKills: { increment: player.kills },
      },
    });
  }

  private createCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  private normalizeVector(x: number, y: number) {
    const length = Math.hypot(x, y);
    if (!Number.isFinite(length) || length <= 0.001) return { x: 0, y: 0 };
    return { x: x / length, y: y / length };
  }

  private clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }
}
