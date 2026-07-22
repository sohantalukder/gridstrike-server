import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReqUser } from '../../common/decorators/req-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MultiplayerService } from './multiplayer.service';

@ApiTags('Matches')
@Controller('api/v1/matches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class MatchesController {
  constructor(private readonly multiplayer: MultiplayerService) {}

  @Get()
  list(@ReqUser() user: { userId: string }) {
    return { playerId: user.userId, matches: this.multiplayer.listMatches(user.userId) };
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.multiplayer.getMatch(id);
  }
}
