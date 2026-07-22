import { Module } from '@nestjs/common';
import { PlayerSettingsController } from './player-settings.controller';

@Module({
  controllers: [PlayerSettingsController],
})
export class PlayerSettingsModule {}
