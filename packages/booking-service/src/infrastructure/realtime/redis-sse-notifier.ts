import type IORedis from 'ioredis';

import type { ISseNotifier, SseNotification } from '../../domain/ports/sse-notifier.port';

export class RedisSseNotifier implements ISseNotifier {
  constructor(private readonly redis: IORedis) {}

  async notify(event: SseNotification): Promise<void> {
    await this.redis.publish('operator:notifications', JSON.stringify(event));
  }
}
