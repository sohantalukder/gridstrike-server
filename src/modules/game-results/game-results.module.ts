import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { GameResultsController } from './game-results.controller';
import { GameResultsService } from './game-results.service';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [GameResultsController],
  providers: [GameResultsService],
})
export class GameResultsModule {}
