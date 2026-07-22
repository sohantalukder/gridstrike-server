import { Module } from '@nestjs/common';
import { AbilitiesController } from './abilities.controller';

@Module({
  controllers: [AbilitiesController],
})
export class AbilitiesModule {}
