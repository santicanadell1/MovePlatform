import type { AiCategorizationJob } from '@move/shared';

export interface IJobQueue {
  enqueue(data: AiCategorizationJob): Promise<void>;
}
