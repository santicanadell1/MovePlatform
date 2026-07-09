import Bull from 'bull';
import { AlertCreatedEvent, RABBITMQ_EXCHANGES, RABBITMQ_ROUTING_KEYS } from '@move/shared';

import { IEventPublisher } from '../../../application/ports/event-publisher';
import { logger } from '../../logger';

import { AlertPersistedPayload } from './p6-alert-generation.worker';

export function registerP7Worker(
  p7Queue: Bull.Queue<AlertPersistedPayload>,
  eventPublisher: IEventPublisher,
): void {
  void p7Queue.process(async (job) => {
    const payload = job.data;

    const event: AlertCreatedEvent = {
      eventId: payload.alertId,
      occurredAt: payload.createdAt,
      alertId: payload.alertId,
      transferId: payload.transferId,
      type: payload.type,
      lat: payload.lat,
      lng: payload.lng,
      message: payload.message,
    };

    try {
      await eventPublisher.publish(
        RABBITMQ_EXCHANGES.MOVE_EVENTS,
        RABBITMQ_ROUTING_KEYS.ALERT_CREATED,
        event,
      );
      logger.debug('P7: alerta publicada en RabbitMQ', {
        alertId: payload.alertId,
        type: payload.type,
      });
    } catch (err) {
      logger.error('P7: error publicando en RabbitMQ — alerta ya persistida en DB', {
        alertId: payload.alertId,
        err,
      });
    }
  });
}
