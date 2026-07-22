import { Module } from '@nestjs/common';
import { DailyChallengesController } from './daily-challenges.controller';

@Module({
  controllers: [DailyChallengesController],
})
export class DailyChallengesModule {}
