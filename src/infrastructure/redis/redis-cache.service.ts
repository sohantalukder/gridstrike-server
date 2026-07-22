import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class RedisCacheService {
  constructor(private readonly redis: RedisService) {}

  async cacheAside<T>(cacheKey: string, fetcher: () => Promise<T>, ttlSeconds = 30): Promise<T> {
    const cached = await this.redis.getJson<T>(cacheKey);
    if (cached) return cached;
    const latest = await fetcher();
    await this.redis.setJson(cacheKey, latest, ttlSeconds);
    return latest;
  }

  async invalidate(keys: string[]): Promise<void> {
    if (!keys.length) return;
    await Promise.all(keys.map((key) => this.redis.del(key)));
  }
}
