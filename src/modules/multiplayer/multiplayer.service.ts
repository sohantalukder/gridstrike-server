import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MatchPlayerState, MultiplayerMatch, MultiplayerRoom, PlayerIntent, QueueEntry } from './multiplayer.types';

@Injectable()
export class MultiplayerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private readonly rooms = new Map<string, MultiplayerRoom>();
  private readonly roomsByCode = new Map<string, string>();
  private readonly rankedQueue = new Map<string, QueueEntry>();
  private readonly matches = new Map<string, MultiplayerMatch>();
  private readonly reconnectTokens = new Map<string, { playerId: string; matchId: string; expiresAt: number }>();

  async playerName(playerId: string) {
    const profile = await this.prisma.playerProfile.findUnique({ where: { userId: playerId } });
    return profile?.displayName ?? `STRIKER-${playerId.slice(0, 5)}`;
  }

  async createRoom(playerId: string) {
    const displayName = await this.playerName(playerId);
    const room: MultiplayerRoom = {
      id: randomUUID(),
      code: this.createCode(),
      status: 'lobby',
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
    if (!room || room.status === 'closed') return null;
    const displayName = await this.playerName(playerId);
    if (!room.players.some((player) => player.playerId === playerId)) {
      room.players.push({ playerId, displayName, ready: false, connected: false });
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
    room.players = room.players.filter((player) => player.playerId !== playerId);
    if (room.players.length === 0 || room.hostPlayerId === playerId) {
      room.status = 'closed';
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

  setReady(playerId: string, roomId: string, ready: boolean, loadoutId?: string) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== 'lobby') return null;
    const player = room.players.find((item) => item.playerId === playerId);
    if (!player) return null;
    player.ready = ready;
    player.loadoutId = loadoutId ?? player.loadoutId;
    return room;
  }

  canStartRoom(room: MultiplayerRoom) {
    return room.status === 'lobby' && room.players.length >= 2 && room.players.every((player) => player.ready);
  }

  startRoomMatch(roomId: string) {
    const room = this.getRoom(roomId);
    if (!room || !this.canStartRoom(room)) return null;
    const match = this.createMatch('private', room.players, room.id, false);
    room.status = 'countdown';
    room.matchId = match.id;
    return match;
  }

  async joinRanked(playerId: string, socketId?: string) {
    const displayName = await this.playerName(playerId);
    const entry: QueueEntry = { playerId, displayName, rating: 1000, socketId, joinedAt: Date.now() };
    const opponent = [...this.rankedQueue.values()].find((item) => item.playerId !== playerId);
    if (opponent) {
      this.rankedQueue.delete(opponent.playerId);
      const match = this.createMatch(
        'ranked',
        [
          { playerId, displayName, socketId },
          { playerId: opponent.playerId, displayName: opponent.displayName, socketId: opponent.socketId },
        ],
        undefined,
        false,
      );
      return { queued: false, match };
    }
    this.rankedQueue.set(playerId, entry);
    if (this.config.get('NODE_ENV') === 'development') {
      const match = this.createMatch(
        'bot',
        [
          { playerId, displayName, socketId },
          { playerId: 'bot-opponent', displayName: 'DEV_BOT' },
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
    return [...this.matches.values()].filter((match) => match.players.some((player) => player.playerId === playerId));
  }

  markLoaded(matchId: string) {
    const match = this.getMatch(matchId);
    if (!match || match.status === 'finished') return null;
    match.status = 'active';
    match.startedAt = match.startedAt ?? Date.now();
    return match;
  }

  applyInput(matchId: string, playerId: string, actionId: string, sequence: number, intent: PlayerIntent) {
    const match = this.getMatch(matchId);
    if (!match || match.status === 'finished') return { accepted: false, reason: 'match-unavailable' };
    const player = match.players.find((item) => item.playerId === playerId);
    if (!player || player.health <= 0) return { accepted: false, reason: 'player-unavailable' };
    if (sequence <= player.sequence) return { accepted: false, reason: 'duplicate-sequence' };

    player.sequence = sequence;
    const movement = this.normalizeVector(intent.movement?.x ?? 0, intent.movement?.y ?? 0);
    const aim = this.normalizeVector(intent.aim?.x ?? player.aimX, intent.aim?.y ?? player.aimY);
    player.aimX = aim.x;
    player.aimY = aim.y;
    player.x = this.clamp(player.x + movement.x * 18, 24, 776);
    player.y = this.clamp(player.y + movement.y * 18, 24, 426);

    if (intent.isFiring) {
      this.applyFire(match, player);
    }
    this.updateBot(match);
    this.finishIfNeeded(match);
    return { accepted: true, actionId, match };
  }

  surrender(matchId: string, playerId: string) {
    const match = this.getMatch(matchId);
    if (!match || match.status === 'finished') return null;
    const other = match.players.find((player) => player.playerId !== playerId);
    match.status = 'finished';
    match.finishedAt = Date.now();
    match.winnerId = other?.playerId;
    void this.persistMatchFinished(match);
    return match;
  }

  reconnectToken(playerId: string, matchId: string) {
    const token = randomUUID();
    this.reconnectTokens.set(token, { playerId, matchId, expiresAt: Date.now() + 30000 });
    return token;
  }

  recoverMatch(token: string) {
    const session = this.reconnectTokens.get(token);
    if (!session || session.expiresAt < Date.now()) return null;
    return this.getMatch(session.matchId);
  }

  snapshot(match: MultiplayerMatch) {
    return {
      matchId: match.id,
      mode: match.mode,
      status: match.status,
      botMatch: match.botMatch,
      serverTime: Date.now(),
      winnerId: match.winnerId,
      players: match.players,
    };
  }

  private createMatch(mode: 'private' | 'ranked' | 'bot', players: Array<{ playerId: string; displayName: string; socketId?: string }>, roomId?: string, botMatch = false) {
    const match: MultiplayerMatch = {
      id: randomUUID(),
      mode,
      roomId,
      status: 'countdown',
      botMatch,
      createdAt: Date.now(),
      players: players.slice(0, 2).map((player, index) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        x: index === 0 ? 120 : 680,
        y: index === 0 ? 220 : 220,
        aimX: index === 0 ? 1 : -1,
        aimY: 0,
        health: 100,
        score: 0,
        kills: 0,
        sequence: 0,
        connected: true,
        bot: player.playerId.startsWith('bot-'),
        lastFireAt: 0,
        socketId: player.socketId,
      })),
    };
    this.matches.set(match.id, match);
    void this.persistMatchCreated(match);
    return match;
  }

  private applyFire(match: MultiplayerMatch, player: MatchPlayerState) {
    const now = Date.now();
    if (now - player.lastFireAt < 220) return;
    player.lastFireAt = now;
    const target = match.players.find((item) => item.playerId !== player.playerId && item.health > 0);
    if (!target) return;
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const distance = Math.hypot(dx, dy);
    const aimDot = distance === 0 ? 1 : (dx / distance) * player.aimX + (dy / distance) * player.aimY;
    if (distance <= 460 && aimDot > 0.35) {
      target.health = this.clamp(target.health - 12, 0, 100);
      player.score += 120;
      if (target.health <= 0) player.kills += 1;
    }
  }

  private updateBot(match: MultiplayerMatch) {
    const bot = match.players.find((player) => player.bot && player.health > 0);
    const target = match.players.find((player) => !player.bot && player.health > 0);
    if (!bot || !target || match.status === 'finished') return;
    const movement = this.normalizeVector(target.x - bot.x, target.y - bot.y);
    bot.x = this.clamp(bot.x + movement.x * 8, 24, 776);
    bot.y = this.clamp(bot.y + movement.y * 8, 24, 426);
    bot.aimX = movement.x;
    bot.aimY = movement.y;
    this.applyFire(match, bot);
  }

  private finishIfNeeded(match: MultiplayerMatch) {
    const alive = match.players.filter((player) => player.health > 0);
    if (alive.length <= 1 && match.status !== 'finished') {
      match.status = 'finished';
      match.finishedAt = Date.now();
      match.winnerId = alive[0]?.playerId;
      void this.persistMatchFinished(match);
    }
  }

  private async persistMatchCreated(match: MultiplayerMatch) {
    try {
      await (this.prisma as any).multiplayerMatch.upsert({
        where: { id: match.id },
        update: { status: match.status, startedAt: match.startedAt ? new Date(match.startedAt) : undefined },
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
          where: { matchId_playerId: { matchId: match.id, playerId: player.playerId } },
          update: { health: player.health, score: player.score, kills: player.kills, connected: player.connected },
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
          finishedAt: match.finishedAt ? new Date(match.finishedAt) : new Date(),
        },
      });
      for (const player of match.players) {
        await (this.prisma as any).matchParticipant.update({
          where: { matchId_playerId: { matchId: match.id, playerId: player.playerId } },
          data: { health: player.health, score: player.score, kills: player.kills, connected: player.connected },
        });
        if (!player.bot) {
          await this.persistPlayerResult(match, player);
        }
      }
    } catch {
      // Result queues and live snapshots still protect the gameplay loop locally.
    }
  }

  private async persistPlayerResult(match: MultiplayerMatch, player: MatchPlayerState) {
    const profile = await this.prisma.playerProfile.findUnique({ where: { userId: player.playerId } });
    if (!profile) return;
    const victory = match.winnerId === player.playerId;
    const durationSeconds = match.startedAt ? Math.max(0, Math.round(((match.finishedAt ?? Date.now()) - match.startedAt) / 1000)) : 0;
    const coins = victory ? 120 : 40;
    const experience = victory ? 2450 : 900;
    await this.prisma.gameResult.upsert({
      where: { idempotencyKey: `multiplayer-${match.id}-${player.playerId}` },
      update: {},
      create: {
        playerProfileId: profile.id,
        idempotencyKey: `multiplayer-${match.id}-${player.playerId}`,
        mode: match.mode,
        status: victory ? 'victory' : 'defeat',
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
