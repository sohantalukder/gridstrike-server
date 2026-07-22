import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReqUser } from '../../common/decorators/req-user.decorator';
import { SubmitGameResultDto } from './dto/submit-game-result.dto';
import { GameResultsService } from './game-results.service';

@ApiTags('GameResults')
@Controller('api/v1/game-results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class GameResultsController {
  constructor(private readonly service: GameResultsService) {}

  @Post()
  @ApiHeader({ name: 'x-client-result-id', required: false })
  submit(@ReqUser() user: { userId: string }, @Body() dto: SubmitGameResultDto, @Req() req: any) {
    const headerId = req.headers['x-client-result-id'];
    const normalizedHeaderId = Array.isArray(headerId) ? headerId[0] : headerId;
    const idempotencyKey = (typeof normalizedHeaderId === 'string' ? normalizedHeaderId : dto.resultId)?.trim();

    if (!idempotencyKey) {
      throw new BadRequestException('Missing idempotency key');
    }

    return this.service.submit(user.userId, dto, idempotencyKey);
  }

  @Get()
  list(@ReqUser() user: { userId: string }) {
    return this.service.list(user.userId);
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.service.findOne(id);
  }
}
