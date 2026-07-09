import type { TransferCompletedEvent } from '@move/shared';
import { RABBITMQ_EXCHANGES, RABBITMQ_QUEUES, RABBITMQ_ROUTING_KEYS } from '@move/shared';
import type { Channel, ConsumeMessage } from 'amqplib';
import type { Logger } from 'winston';

import type { CompleteReservationUseCase } from '../../application/use-cases/complete-reservation.use-case';

export class TransferCompletedConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly completeReservationUseCase: CompleteReservationUseCase,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    const exchange = RABBITMQ_EXCHANGES.MOVE_EVENTS;
    const queue = RABBITMQ_QUEUES.BOOKING_TRANSFER_COMPLETED;
    const routingKey = RABBITMQ_ROUTING_KEYS.TRANSFER_COMPLETED;

    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, exchange, routingKey);

    await this.channel.consume(queue, (msg) => {
      void this.handleMessage(msg);
    });
    this.logger.info('Consumer iniciado: transfer.completed');
  }

  private handleMessage = async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString()) as TransferCompletedEvent;
      await this.completeReservationUseCase.execute({ reservationId: event.reservationId });
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error('Error procesando transfer.completed', { err });
      this.channel.nack(msg, false, false);
    }
  };
}
