import { Module } from '@nestjs/common';
import { WeaponsController } from './weapons.controller';

@Module({
  controllers: [WeaponsController],
})
export class WeaponsModule {}
