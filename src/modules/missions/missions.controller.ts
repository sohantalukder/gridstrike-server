import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReqUser } from '../../common/decorators/req-user.decorator';

const MISSIONS = [
  { id: 'defeat-30', title: 'Defeat 30 enemies', objective: 'defeatEnemies', target: 30, rewardXp: 120, rewardCoins: 80 },
  { id: 'capture-3', title: 'Capture three nodes', objective: 'captureNodes', target: 3, rewardXp: 150, rewardCoins: 110 },
  { id: 'survive-5m', title: 'Survive 5 minutes', objective: 'surviveSeconds', target: 300, rewardXp: 200, rewardCoins: 180 },
];

@ApiTags('Missions')
@Controller('api/v1/missions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class MissionsController {
  @Get()
  list() {
    return MISSIONS;
  }

  @Get('active')
  active(@ReqUser() user: { userId: string }) {
    return { ...MISSIONS[0], playerId: user.userId };
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return MISSIONS.find((mission) => mission.id === id);
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @ReqUser() user: { userId: string }) {
    return { claimed: true, missionId: id, playerId: user.userId };
  }
}
