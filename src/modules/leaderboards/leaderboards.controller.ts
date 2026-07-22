import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReqUser } from '../../common/decorators/req-user.decorator';
import { PrismaService } from '../../infrastructure/database/prisma.service';

type LeaderboardKind = 'practice' | 'survival' | 'missions' | 'daily';

@ApiTags('Leaderboards')
@Controller('api/v1/leaderboards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class LeaderboardsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('survival')
  survival() {
    return this.listByType('survival');
  }

  @Get('missions')
  missions() {
    return this.listByType('missions');
  }

  @Get('daily')
  daily() {
    return this.listByType('daily');
  }

  @Get('ranked')
  ranked() {
    return this.listByType('survival');
  }

  @Get('me')
  async mine(@ReqUser() user: { userId: string }) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({
      where: { userId: user.userId },
    });
    const best = await this.prisma.leaderboardEntry.findFirst({
      where: { playerProfileId: profile.id },
      orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
    });

    return {
      playerId: user.userId,
      rank: best?.rank ?? profile.rank,
      score: best?.score ?? 0,
      mode: best?.leaderboardType ?? 'practice',
    };
  }

  private async listByType(type: LeaderboardKind) {
    const entries = await this.prisma.leaderboardEntry.findMany({
      where: { leaderboardType: type },
      include: {
        playerProfile: {
          select: {
            userId: true,
            displayName: true,
            level: true,
            rank: true,
          },
        },
      },
      orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
      take: 50,
    });

    return {
      mode: type,
      entries: entries.map((entry, index) => ({
        playerId: entry.playerProfile.userId,
        player: entry.playerProfile.displayName,
        level: entry.playerProfile.level,
        rank: index + 1,
        score: entry.score,
        leaderboardRank: entry.playerProfile.rank,
        updatedAt: entry.updatedAt,
      })),
    };
  }
}
