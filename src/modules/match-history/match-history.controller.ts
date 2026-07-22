import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReqUser } from '../../common/decorators/req-user.decorator';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@ApiTags('MatchHistory')
@Controller('api/v1/match-history')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class MatchHistoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@ReqUser() user: { userId: string }) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({
      where: { userId: user.userId },
    });
    const matches = await this.prisma.gameResult.findMany({
      where: { playerProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });

    return { playerId: user.userId, matches };
  }
}
