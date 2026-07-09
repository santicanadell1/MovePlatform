import type { Channel, ConsumeMessage } from 'amqplib';
import type { Logger } from 'winston';
import type { ReservationClassifiedEvent } from '@move/shared';
import { RABBITMQ_EXCHANGES, RABBITMQ_QUEUES, RABBITMQ_ROUTING_KEYS } from '@move/shared';

import type { ResumeClassifiedReservationUseCase } from '../../application/use-cases/resume-classified-reservation.use-case';

export class ReservationClassifiedConsumer {
  constructor(
    private readonly channel: Channel,
    private readonly resumeUseCase: ResumeClassifiedReservationUseCase,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    const exchange = RABBITMQ_EXCHANGES.MOVE_EVENTS;
    const queue = RABBITMQ_QUEUES.BOOKING_CLASSIFIED;
    const routingKey = RABBITMQ_ROUTING_KEYS.RESERVATION_CLASSIFIED;

    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.bindQueue(queue, exchange, routingKey);

    await this.channel.consume(queue, (msg) => {
      void this.handleMessage(msg);
    });
  }

  private handleMessage = async (msg: ConsumeMessage | null): Promise<void> => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString()) as ReservationClassifiedEvent;
      await this.resumeUseCase.execute(event);
      this.channel.ack(msg);
    } catch (err) {
      this.logger.error('Error procesando reservation.classified', { err });
      this.channel.nack(msg, false, false);
    }
  };
}
