import type { Channel, ConsumeMessage } from 'amqplib';
import type { TransferCompletedEvent } from '@move/shared';
import { RABBITMQ_EXCHANGES, RABBITMQ_QUEUES, RABBITMQ_ROUTING_KEYS } from '@move/shared';

import type { CompleteReservationUseCase } from '../../../application/use-cases/complete-reservation.use-case';
import { TransferCompletedConsumer } from '../transfer-completed.consumer';

type ConsumeCallback = (msg: ConsumeMessage | null) => void;

interface ChannelMock {
  assertExchange: jest.Mock;
  assertQueue: jest.Mock;
  bindQueue: jest.Mock;
  consume: jest.Mock;
  ack: jest.Mock;
  nack: jest.Mock;
}

function buildMockChannel(): {
  mock: ChannelMock;
  channel: Channel;
  triggerMessage: (msg: ConsumeMessage | null) => void;
} {
  let capturedCallback: ConsumeCallback | null = null;

  const mock: ChannelMock = {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue({ queue: RABBITMQ_QUEUES.BOOKING_TRANSFER_COMPLETED }),
    bindQueue: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockImplementation((_queue: string, cb: ConsumeCallback) => {
      capturedCallback = cb;
      return Promise.resolve({ consumerTag: 'tag-1' });
    }),
    ack: jest.fn(),
    nack: jest.fn(),
  };

  const triggerMessage = (msg: ConsumeMessage | null): void => {
    if (!capturedCallback) throw new Error('consume no fue llamado');
    capturedCallback(msg);
  };

  return { mock, channel: mock as unknown as Channel, triggerMessage };
}

function fakeTransferCompletedEvent(): TransferCompletedEvent {
  return {
    eventId: 'evt-1',
    occurredAt: '2026-01-01T00:00:00Z',
    transferId: 'transfer-1',
    reservationId: 'res-1',
    finishedAt: '2026-01-01T01:00:00Z',
  };
}

function mockUseCase(): jest.Mocked<Pick<CompleteReservationUseCase, 'execute'>> {
  return { execute: jest.fn().mockResolvedValue(undefined) };
}

const logger = { error: jest.fn(), info: jest.fn(), warn: jest.fn() };

describe('TransferCompletedConsumer', () => {
  it('configura exchange, queue y binding correctos al arrancar', async () => {
    const { mock, channel } = buildMockChannel();
    const consumer = new TransferCompletedConsumer(
      channel,
      mockUseCase() as unknown as CompleteReservationUseCase,
      logger as never,
    );

    await consumer.start();

    expect(mock.assertExchange).toHaveBeenCalledWith(RABBITMQ_EXCHANGES.MOVE_EVENTS, 'topic', {
      durable: true,
    });
    expect(mock.assertQueue).toHaveBeenCalledWith(RABBITMQ_QUEUES.BOOKING_TRANSFER_COMPLETED, {
      durable: true,
    });
    expect(mock.bindQueue).toHaveBeenCalledWith(
      RABBITMQ_QUEUES.BOOKING_TRANSFER_COMPLETED,
      RABBITMQ_EXCHANGES.MOVE_EVENTS,
      RABBITMQ_ROUTING_KEYS.TRANSFER_COMPLETED,
    );
  });

  it('deserializa el evento, llama al use case con reservationId y hace ack', async () => {
    const { mock, channel, triggerMessage } = buildMockChannel();
    const useCase = mockUseCase();
    const consumer = new TransferCompletedConsumer(
      channel,
      useCase as unknown as CompleteReservationUseCase,
      logger as never,
    );
    await consumer.start();

    const event = fakeTransferCompletedEvent();
    const msg = { content: Buffer.from(JSON.stringify(event)) } as ConsumeMessage;
    triggerMessage(msg);

    await new Promise((r) => setTimeout(r, 0));

    expect(useCase.execute).toHaveBeenCalledWith({ reservationId: 'res-1' });
    expect(mock.ack).toHaveBeenCalledWith(msg);
    expect(mock.nack).not.toHaveBeenCalled();
  });

  it('hace nack sin requeue si el use case lanza error', async () => {
    const { mock, channel, triggerMessage } = buildMockChannel();
    const useCase = mockUseCase();
    useCase.execute.mockRejectedValue(new Error('DB error'));
    const consumer = new TransferCompletedConsumer(
      channel,
      useCase as unknown as CompleteReservationUseCase,
      logger as never,
    );
    await consumer.start();

    const msg = {
      content: Buffer.from(JSON.stringify(fakeTransferCompletedEvent())),
    } as ConsumeMessage;
    triggerMessage(msg);

    await new Promise((r) => setTimeout(r, 0));

    expect(mock.nack).toHaveBeenCalledWith(msg, false, false);
    expect(mock.ack).not.toHaveBeenCalled();
  });

  it('ignora mensajes null del broker sin lanzar error', async () => {
    const { channel, triggerMessage } = buildMockChannel();
    const useCase = mockUseCase();
    const consumer = new TransferCompletedConsumer(
      channel,
      useCase as unknown as CompleteReservationUseCase,
      logger as never,
    );
    await consumer.start();

    expect(() => triggerMessage(null)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
    expect(useCase.execute).not.toHaveBeenCalled();
  });
});
