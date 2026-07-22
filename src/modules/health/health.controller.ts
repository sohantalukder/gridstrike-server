import { Controller, Get } from '@nestjs/common';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { RedisService } from '../../infrastructure/redis/redis.service';

@Controller('api/v1/health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  ping() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Get('database')
  async database() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: 'ok', connection: 'postgresql' };
    } catch (error) {
      return { database: 'down', connection: 'postgresql', reason: 'unavailable' };
    }
  }

  @Get('redis')
  async redisStatus() {
    try {
      await this.redis.client.ping();
      return { redis: 'ok', connection: 'redis' };
    } catch (error) {
      return { redis: 'down', connection: 'redis', reason: 'unavailable' };
    }
  }
}
