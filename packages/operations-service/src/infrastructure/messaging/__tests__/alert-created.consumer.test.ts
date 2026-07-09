import type { Channel, ConsumeMessage } from 'amqplib';
import type { Pool } from 'pg';
import type { Logger } from 'winston';
import { RABBITMQ_EXCHANGES, RABBITMQ_QUEUES, RABBITMQ_ROUTING_KEYS } from '@move/shared';

import { AlertCreatedConsumer } from '../alert-created.consumer';

const DLQ = `${RABBITMQ_QUEUES.OPERATIONS_ALERT}.dlq`;
const ROUTING_KEY = RABBITMQ_ROUTING_KEYS.ALERT_CREATED;

function makeMsg(payload: object): ConsumeMessage {
  return { content: Buffer.from(JSON.stringify(payload)) } as ConsumeMessage;
}

describe('AlertCreatedConsumer', () => {
  let channel: {
    assertExchange: jest.Mock;
    assertQueue: jest.Mock;
    bindQueue: jest.Mock;
    consume: jest.Mock;
    ack: jest.Mock;
    nack: jest.Mock;
  };
  let pool: { query: jest.Mock };
  let logger: { info: jest.Mock; error: jest.Mock };
  let consumer: AlertCreatedConsumer;

  beforeEach(() => {
    channel = {
      assertExchange: jest.fn().mockResolvedValue(undefined),
      assertQueue: jest.fn().mockResolvedValue({ queue: '', messageCount: 0, consumerCount: 0 }),
      bindQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue({ consumerTag: 'tag' }),
      ack: jest.fn(),
      nack: jest.fn(),
    };
    pool = {
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    };
    logger = {
      info: jest.fn(),
      error: jest.fn(),
    };
    consumer = new AlertCreatedConsumer(
      channel as unknown as Channel,
      pool as unknown as Pool,
      logger as unknown as Logger,
    );
  });

  // -------------------------------------------------------------------------
  // start()
  // -------------------------------------------------------------------------

  describe('start()', () => {
    it('assertExchange es llamado para move.events y move.dlx', async () => {
      await consumer.start();

      expect(channel.assertExchange).toHaveBeenCalledWith(RABBITMQ_EXCHANGES.MOVE_EVENTS, 'topic', {
        durable: true,
      });
      expect(channel.assertExchange).toHaveBeenCalledWith(RABBITMQ_EXCHANGES.MOVE_DLX, 'topic', {
        durable: true,
      });
    });

    it('assertQueue es llamado con x-dead-letter-exchange para la cola principal', async () => {
      await consumer.start();

      expect(channel.assertQueue).toHaveBeenCalledWith(
        RABBITMQ_QUEUES.OPERATIONS_ALERT,
        expect.objectContaining({
          durable: true,
          arguments: { 'x-dead-letter-exchange': RABBITMQ_EXCHANGES.MOVE_DLX },
        }),
      );
    });

    it('assertQueue es llamado para la DLQ', async () => {
      await consumer.start();

      expect(channel.assertQueue).toHaveBeenCalledWith(DLQ, { durable: true });
    });

    it('bindQueue es llamado para la DLQ en el DLX', async () => {
      await consumer.start();

      expect(channel.bindQueue).toHaveBeenCalledWith(DLQ, RABBITMQ_EXCHANGES.MOVE_DLX, ROUTING_KEY);
    });

    it('consume es llamado en la cola principal', async () => {
      await consumer.start();

      expect(channel.consume).toHaveBeenCalledWith(
        RABBITMQ_QUEUES.OPERATIONS_ALERT,
        expect.any(Function),
      );
    });
  });

  // -------------------------------------------------------------------------
  // handle()
  // -------------------------------------------------------------------------

  describe('handle() — invocado directamente via (consumer as any).handle', () => {
    const VALID_EVENT = {
      eventId: 'evt-1',
      occurredAt: '2026-06-04T00:00:00.000Z',
      alertId: 'alert-1',
      transferId: 'transfer-1',
      type: 'ZONE_RED_ENTRY',
      lat: -34.9,
      lng: -56.1,
      message: 'Zona roja detectada',
    };

    type WithHandle = { handle: (msg: ConsumeMessage | null) => Promise<void> };
    const callHandle = (c: AlertCreatedConsumer, msg: ConsumeMessage | null): Promise<void> =>
      (c as unknown as WithHandle).handle(msg);

    it('ack y persiste el evento cuando pool.query tiene éxito', async () => {
      const msg = makeMsg(VALID_EVENT);

      await callHandle(consumer, msg);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO operations.alerts_projection'),
        [
          VALID_EVENT.alertId,
          VALID_EVENT.transferId,
          VALID_EVENT.type,
          VALID_EVENT.lat,
          VALID_EVENT.lng,
          VALID_EVENT.message,
          VALID_EVENT.occurredAt,
        ],
      );
      expect(channel.ack).toHaveBeenCalledWith(msg);
      expect(channel.nack).not.toHaveBeenCalled();
    });

    it('nack(msg, false, false) y loguea error cuando pool.query falla', async () => {
      pool.query.mockRejectedValue(new Error('DB connection lost'));
      const msg = makeMsg(VALID_EVENT);

      await callHandle(consumer, msg);

      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it('nack cuando el content no es JSON válido', async () => {
      const msg = { content: Buffer.from('not-json') } as ConsumeMessage;

      await callHandle(consumer, msg);

      expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
      expect(channel.ack).not.toHaveBeenCalled();
    });

    it('no hace nada cuando msg es null', async () => {
      await callHandle(consumer, null);

      expect(pool.query).not.toHaveBeenCalled();
      expect(channel.ack).not.toHaveBeenCalled();
      expect(channel.nack).not.toHaveBeenCalled();
    });
  });
});
