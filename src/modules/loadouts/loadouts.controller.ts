import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReqUser } from '../../common/decorators/req-user.decorator';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@ApiTags('Loadouts')
@Controller('api/v1/loadouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class LoadoutsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@ReqUser() user: { userId: string }) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({ where: { userId: user.userId } });
    const list = await this.prisma.loadout.findMany({
      where: { playerProfileId: profile.id },
      orderBy: [{ isSelected: 'desc' }, { name: 'asc' }],
    });

    return list;
  }

  @Post()
  async create(
    @ReqUser() user: { userId: string },
    @Body() body: { name: string; weaponId: string; primaryAbilityId: string; secondaryAbilityId: string },
  ) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({ where: { userId: user.userId } });
    return this.prisma.loadout.create({
      data: {
        playerProfileId: profile.id,
        name: body.name,
        weaponId: body.weaponId,
        primaryAbilityId: body.primaryAbilityId,
        secondaryAbilityId: body.secondaryAbilityId,
      },
    });
  }

  @Put(':id')
  async update(
    @ReqUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { weaponId?: string; primaryAbilityId?: string; secondaryAbilityId?: string },
  ) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({ where: { userId: user.userId } });
    const current = await this.prisma.loadout.findFirst({ where: { id, playerProfileId: profile.id } });
    if (!current) return null;
    return this.prisma.loadout.update({
      where: { id },
      data: {
        weaponId: body.weaponId,
        primaryAbilityId: body.primaryAbilityId,
        secondaryAbilityId: body.secondaryAbilityId,
      },
    });
  }

  @Post(':id/select')
  async select(@ReqUser() user: { userId: string }, @Param('id') id: string) {
    const profile = await this.prisma.playerProfile.findUniqueOrThrow({ where: { userId: user.userId } });
    const current = await this.prisma.loadout.findFirst({ where: { id, playerProfileId: profile.id } });
    if (!current) return null;
    await this.prisma.loadout.updateMany({
      where: { playerProfileId: profile.id },
      data: { isSelected: false },
    });
    return this.prisma.loadout.update({
      where: { id },
      data: { isSelected: true },
    });
  }
}
