import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReqUser } from '../../common/decorators/req-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MultiplayerService } from './multiplayer.service';

@ApiTags('Rooms')
@Controller('api/v1/rooms')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class RoomsController {
  constructor(private readonly multiplayer: MultiplayerService) {}

  @Post()
  create(@ReqUser() user: { userId: string }) {
    return this.multiplayer.createRoom(user.userId);
  }

  @Post('join')
  join(@ReqUser() user: { userId: string }, @Body() body: { code: string }) {
    return this.multiplayer.joinRoom(user.userId, body.code);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.multiplayer.getRoom(id);
  }

  @Post(':id/leave')
  leave(@ReqUser() user: { userId: string }, @Param('id') id: string) {
    return this.multiplayer.leaveRoom(user.userId, id);
  }
}
