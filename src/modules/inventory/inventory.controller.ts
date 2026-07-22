import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReqUser } from '../../common/decorators/req-user.decorator';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@ApiTags('Inventory')
@Controller('api/v1/inventory')
export class InventoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async list(@ReqUser() user: { userId: string }) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({ where: { userId: user.userId } });
    return (this.prisma as any).playerInventoryItem.findMany({
      where: { playerProfileId: profile.id },
      orderBy: [{ unlockedAt: 'desc' }],
    });
  }

  @Post('unlock')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async unlock(@ReqUser() user: { userId: string }, @Body() body: { itemId: string }) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({ where: { userId: user.userId } });
    await (this.prisma as any).playerInventoryItem.upsert({
      where: { playerProfileId_itemId: { playerProfileId: profile.id, itemId: body.itemId } },
      update: {},
      create: { playerProfileId: profile.id, itemId: body.itemId, level: 1 },
    });
    return this.list(user);
  }

  @Post('upgrade')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async upgrade(@ReqUser() user: { userId: string }, @Body() body: { itemId: string }) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({ where: { userId: user.userId } });
    const existing = await (this.prisma as any).playerInventoryItem.findUnique({
      where: { playerProfileId_itemId: { playerProfileId: profile.id, itemId: body.itemId } },
    });
    if (existing) {
      await (this.prisma as any).playerInventoryItem.update({
        where: { id: existing.id },
        data: { level: Math.min((existing.level ?? 1) + 1, 5) },
      });
    }
    return this.list(user);
  }
}
