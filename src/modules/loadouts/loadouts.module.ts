import { Module } from '@nestjs/common';
import { LoadoutsController } from './loadouts.controller';

@Module({
  controllers: [LoadoutsController],
})
export class LoadoutsModule {}
