import { Module } from '@nestjs/common';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { GameResultProcessor } from './game-result.queue';

@Module({
  imports: [
    ConfigModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host: cfg.get('REDIS_HOST') || '127.0.0.1',
          port: Number(cfg.get('REDIS_PORT') || 6379),
          password: cfg.get('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'game-results',
    }),
  ],
  providers: [GameResultProcessor],
  exports: [BullModule],
})
export class QueuesModule {}
