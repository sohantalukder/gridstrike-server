import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReqUser } from '../../common/decorators/req-user.decorator';

@ApiTags('Rewards')
@Controller('api/v1/rewards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class RewardsController {
  @Get()
  list(@ReqUser() user: { userId: string }) {
    return { playerId: user.userId, rewards: [] };
  }

  @Post(':id/claim')
  claim(@Param('id') id: string, @ReqUser() user: { userId: string }) {
    return { playerId: user.userId, rewardId: id, claimed: true };
  }
}
