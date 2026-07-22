import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReqUser } from '../../common/decorators/req-user.decorator';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@ApiTags('Achievements')
@Controller('api/v1/achievements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class AchievementsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@ReqUser() user: { userId: string }) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({ where: { userId: user.userId } });
    const achievements = await this.prisma.achievement.findMany({ orderBy: { title: 'asc' } });
    const unlocked = await this.prisma.playerAchievement.findMany({ where: { playerProfileId: profile.id } });
    const unlockedIds = new Set(unlocked.map((item) => item.achievementId));
    return achievements.map((achievement) => ({
      ...achievement,
      unlocked: unlockedIds.has(achievement.id),
    }));
  }
}
