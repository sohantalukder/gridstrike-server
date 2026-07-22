import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReqUser } from '../../common/decorators/req-user.decorator';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@ApiTags('PlayerSettings')
@Controller('api/v1/player-settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PlayerSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async get(@ReqUser() user: { userId: string }) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({ where: { userId: user.userId } });
    return (this.prisma as any).playerSettings.upsert({
      where: { playerProfileId: profile.id },
      update: {},
      create: { playerProfileId: profile.id },
    });
  }

  @Patch()
  async update(@ReqUser() user: { userId: string }, @Body() body: Record<string, any>) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({ where: { userId: user.userId } });
    return (this.prisma as any).playerSettings.upsert({
      where: { playerProfileId: profile.id },
      update: {
        music: this.numberOrUndefined(body.music),
        sfx: this.numberOrUndefined(body.sfx),
        haptic: typeof body.haptic === 'boolean' ? body.haptic : undefined,
        joystickOpacity: this.numberOrUndefined(body.joystickOpacity),
      },
      create: {
        playerProfileId: profile.id,
        music: this.numberOrDefault(body.music, 0.55),
        sfx: this.numberOrDefault(body.sfx, 0.75),
        haptic: typeof body.haptic === 'boolean' ? body.haptic : true,
        joystickOpacity: this.numberOrDefault(body.joystickOpacity, 0.8),
      },
    });
  }

  private numberOrUndefined(value: unknown) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return Math.max(0, Math.min(1, value));
  }

  private numberOrDefault(value: unknown, fallback: number) {
    return this.numberOrUndefined(value) ?? fallback;
  }
}
