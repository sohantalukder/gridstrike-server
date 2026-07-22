import { Global, Module, Provider } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';
import { RedisCacheService } from './redis-cache.service';

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return new Redis({
      host: config.get('REDIS_HOST') || '127.0.0.1',
      port: Number(config.get('REDIS_PORT') || 6379),
      password: config.get('REDIS_PASSWORD') || undefined,
    });
  },
};

@Global()
@Module({
  imports: [ConfigModule],
  providers: [redisProvider, RedisService, RedisCacheService],
  exports: [REDIS_CLIENT, RedisService, RedisCacheService],
})
export class RedisModule {}
