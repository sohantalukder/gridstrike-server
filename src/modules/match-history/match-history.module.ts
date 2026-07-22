import { Module } from '@nestjs/common';
import { MatchHistoryController } from './match-history.controller';

@Module({
  controllers: [MatchHistoryController],
})
export class MatchHistoryModule {}
