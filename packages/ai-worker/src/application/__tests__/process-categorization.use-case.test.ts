import { RABBITMQ_EXCHANGES, RABBITMQ_ROUTING_KEYS } from '@move/shared';
import type { AiCategorizationJob } from '@move/shared';

import type { LlmClassificationResult } from '../../infrastructure/ollama/ollama-llm.categorizador';
import { ProcessCategorizationUseCase } from '../process-categorization.use-case';

interface PublisherMock {
  publish: jest.Mock;
}

function makePublisher(): PublisherMock {
  return { publish: jest.fn().mockResolvedValue(undefined) };
}

interface CategorizadorMock {
  classify: jest.Mock<Promise<LlmClassificationResult | null>>;
}

function makeCategorizador(result: LlmClassificationResult | null): CategorizadorMock {
  return {
    classify: jest
      .fn<Promise<LlmClassificationResult | null>, [string, unknown[]]>()
      .mockResolvedValue(result),
  };
}

const baseJob: AiCategorizationJob = {
  reservationId: 'res-1',
  goodDescription: 'televisor samsung',
  categories: [{ id: 'cat-1', name: 'Electrónica' }],
};

describe('ProcessCategorizationUseCase', () => {
  it('publica reservation.classified cuando Ollama clasifica correctamente', async () => {
    const categorizador = makeCategorizador({
      categoryId: 'cat-1',
      categoryName: 'Electrónica',
      confidence: 0.9,
    });
    const publisher = makePublisher();
    const uc = new ProcessCategorizationUseCase(categorizador as never, publisher);

    await uc.execute(baseJob);

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledWith(
      RABBITMQ_EXCHANGES.MOVE_EVENTS,
      RABBITMQ_ROUTING_KEYS.RESERVATION_CLASSIFIED,
      expect.objectContaining({
        reservationId: 'res-1',
        categoryId: 'cat-1',
        categoryName: 'Electrónica',
      }),
    );
  });

  it('publica reservation.unclassified cuando Ollama no puede clasificar', async () => {
    const categorizador = makeCategorizador(null);
    const publisher = makePublisher();
    const uc = new ProcessCategorizationUseCase(categorizador as never, publisher);

    await uc.execute(baseJob);

    expect(publisher.publish).toHaveBeenCalledTimes(1);
    expect(publisher.publish).toHaveBeenCalledWith(
      RABBITMQ_EXCHANGES.MOVE_EVENTS,
      RABBITMQ_ROUTING_KEYS.RESERVATION_UNCLASSIFIED,
      expect.objectContaining({ reservationId: 'res-1' }),
    );
  });

  it('pasa las categories del job al categorizador', async () => {
    const categorizador = makeCategorizador(null);
    const publisher = makePublisher();
    const uc = new ProcessCategorizationUseCase(categorizador as never, publisher);
    const job: AiCategorizationJob = {
      ...baseJob,
      categories: [{ id: 'cat-x', name: 'Especial' }],
    };

    await uc.execute(job);

    expect(categorizador.classify).toHaveBeenCalledWith(baseJob.goodDescription, [
      { id: 'cat-x', name: 'Especial' },
    ]);
  });
});
