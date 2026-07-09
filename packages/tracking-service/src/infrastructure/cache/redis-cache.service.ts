import { inject, injectable } from 'inversify';
import Redis from 'ioredis';

import { ICacheService } from '../../application/ports/cache.service';
import { TYPES } from '../../types';

@injectable()
export class RedisCacheService implements ICacheService {
  constructor(
    @inject(TYPES.RedisClient) private readonly redis: Redis,
  ) {}

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}
