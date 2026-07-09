import type { AiCategorizationJob } from '@move/shared';
import { AI_QUEUES } from '@move/shared';
import Bull from 'bull';

import type { IJobQueue } from '../../domain/ports/job-queue.port';

export class BullAiJobQueue implements IJobQueue {
  private readonly queue: Bull.Queue<AiCategorizationJob>;

  constructor(redisUrl: string) {
    this.queue = new Bull<AiCategorizationJob>(AI_QUEUES.CATEGORIZATION, redisUrl);
  }

  async enqueue(data: AiCategorizationJob): Promise<void> {
    await this.queue.add(data, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
  }
}
