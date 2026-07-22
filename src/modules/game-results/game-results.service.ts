import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { SubmitGameResultDto } from './dto/submit-game-result.dto';

type LeaderboardKind = 'practice' | 'survival' | 'missions' | 'daily';

@Injectable()
export class GameResultsService {
  private readonly MAX_SCORE = 100_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async submit(playerId: string, dto: SubmitGameResultDto, idempotencyKey: string) {
    const cleanPayload = this.normalizePayload(dto);

    const lock = `result-lock:${playerId}:${idempotencyKey}`;
    const acquired = await this.redis.setIfAbsent(lock, '1', 120);
    if (!acquired) {
      throw new ConflictException('Duplicate submission');
    }

    try {
      const exists = await this.prisma.gameResult.findFirst({ where: { idempotencyKey } });
      if (exists) {
        return exists;
      }

      const profile = await this.prisma.playerProfile.findUniqueOrThrow({ where: { userId: playerId } });
      const leaderboardType = this.mapLeaderboardType(cleanPayload.mode);
      const serverScore = this.calculateServerScore(cleanPayload);
      const serverCoins = this.calculateCoins(cleanPayload);
      const serverExperience = this.calculateExperience(cleanPayload, serverScore);
      const level = this.calculateLevel(profile.experience + serverExperience);
      const nextLevel = Math.max(profile.level, level);

      const result = await this.prisma.$transaction(async (tx) => {
        const created = await tx.gameResult.create({
          data: {
            idempotencyKey,
            mode: cleanPayload.mode,
            score: serverScore,
            kills: cleanPayload.kills,
            durationSeconds: cleanPayload.durationSeconds,
            nodesCaptured: cleanPayload.nodesCaptured,
            damageTaken: cleanPayload.damageTaken,
            status: cleanPayload.status,
            coins: serverCoins,
            experience: serverExperience,
            playerProfileId: profile.id,
          },
        });

        await tx.playerProfile.update({
          where: { id: profile.id },
          data: {
            totalGames: { increment: 1 },
            totalKills: { increment: cleanPayload.kills },
            totalSurvivalSeconds: { increment: cleanPayload.durationSeconds },
            coins: { increment: serverCoins },
            experience: { increment: serverExperience },
            level: nextLevel,
          },
        });

        await tx.playerReward.create({
          data: {
            playerProfileId: profile.id,
            kind: 'match-result',
            amount: serverExperience,
            status: 'granted',
            referenceId: created.id,
          },
        });

        const existing = await tx.leaderboardEntry.findUnique({
          where: {
            playerProfileId_leaderboardType: {
              playerProfileId: profile.id,
              leaderboardType,
            },
          },
        });

        const bestScore = existing ? Math.max(existing.score, serverScore) : serverScore;

        await tx.leaderboardEntry.upsert({
          where: { playerProfileId_leaderboardType: { playerProfileId: profile.id, leaderboardType } },
          create: {
            playerProfileId: profile.id,
            leaderboardType,
            score: serverScore,
            rank: 1,
          },
          update: {
            score: bestScore,
            rank: existing ? existing.rank : 1,
          },
        });

        return created;
      });

      return result;
    } finally {
      await this.redis.del(lock);
    }
  }

  async list(playerId: string) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({ where: { userId: playerId } });
    return this.prisma.gameResult.findMany({
      where: { playerProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.gameResult.findUniqueOrThrow({ where: { id } });
  }

  private normalizePayload(dto: SubmitGameResultDto) {
    const mode = dto.mode;
    if (dto.kills < 0 || dto.durationSeconds < 0 || dto.nodesCaptured < 0 || dto.score < 0 || dto.damageTaken < 0) {
      throw new BadRequestException('Result values outside expected bounds.');
    }

    if (dto.kills > 5000 || dto.durationSeconds > 3600 || dto.nodesCaptured > 12) {
      throw new BadRequestException('Result values outside expected bounds.');
    }

    if (dto.mode === 'missions' && !dto.missionId) {
      throw new BadRequestException('Mission mode requires missionId.');
    }

    if (dto.mode === 'dailyChallenge' && !dto.dailyChallengeId) {
      throw new BadRequestException('Daily challenge mode requires dailyChallengeId.');
    }

    const clampedDamage = Math.min(100, dto.damageTaken);

    return {
      ...dto,
      damageTaken: Math.max(0, clampedDamage),
      status: dto.status,
      mode,
    };
  }

  private calculateServerScore(payload: SubmitGameResultDto): number {
    const durationBonus = Math.floor(payload.durationSeconds * 1.4);
    const killsBonus = payload.kills * 45;
    const nodeBonus = payload.nodesCaptured * 320;
    const victoryBonus = payload.status === 'victory' ? 500 : 0;
    const raw = durationBonus + killsBonus + nodeBonus + victoryBonus;
    return Math.min(this.MAX_SCORE, raw);
  }

  private calculateCoins(payload: SubmitGameResultDto): number {
    const base = Math.floor(this.calculateServerScore(payload) / 75);
    const damageFactor = Math.max(0.5, (100 - payload.damageTaken) / 100);
    return Math.max(0, Math.floor(base * damageFactor));
  }

  private calculateExperience(payload: SubmitGameResultDto, score: number): number {
    const modeMultiplier = payload.mode === 'survival' ? 1.35 : payload.mode === 'missions' ? 1.5 : 1;
    const base = Math.floor(score / 50);
    return Math.max(0, Math.floor(base * modeMultiplier));
  }

  private mapLeaderboardType(mode: string): LeaderboardKind {
    switch (mode) {
      case 'dailyChallenge':
        return 'daily';
      case 'missions':
        return 'missions';
      case 'survival':
        return 'survival';
      default:
        return 'practice';
    }
  }

  private calculateLevel(totalExperience: number): number {
    return Math.max(1, Math.floor(totalExperience / 900) + 1);
  }
}
