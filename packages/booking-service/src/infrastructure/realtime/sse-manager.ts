import { randomUUID } from 'node:crypto';

import type { Response } from 'express';
import type IORedis from 'ioredis';

import type { SseNotification } from '../../domain/ports/sse-notifier.port';

export class SseManager {
  private readonly connections = new Map<string, Response>();

  addConnection(res: Response): string {
    const id = randomUUID();
    this.connections.set(id, res);
    res.on('close', () => {
      this.removeConnection(id);
    });
    return id;
  }

  removeConnection(id: string): void {
    this.connections.delete(id);
  }

  push(event: SseNotification): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;
    for (const res of this.connections.values()) {
      res.write(data);
    }
  }

  async initialize(subscriber: IORedis): Promise<void> {
    await subscriber.subscribe('operator:notifications');
    subscriber.on('message', (_channel: string, message: string) => {
      try {
        const event = JSON.parse(message) as SseNotification;
        this.push(event);
      } catch {
        // mensaje malformado — ignorar
      }
    });
  }
}
