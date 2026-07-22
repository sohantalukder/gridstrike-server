import { Module } from '@nestjs/common';
import { LeaderboardsController } from './leaderboards.controller';

@Module({
  controllers: [LeaderboardsController],
})
export class LeaderboardsModule {}
