import type { Channel } from 'amqplib';
import type { DomainEvent } from '@move/shared';

import { RabbitMQEventPublisher } from '../rabbitmq-event-publisher';

interface ChannelMock {
  assertExchange: jest.Mock;
  publish: jest.Mock;
}

type PublishCall = [exchange: string, routingKey: string, content: Buffer, options: unknown];

function fakeEvent(): DomainEvent {
  return { eventId: 'evt-1', occurredAt: '2026-01-01T00:00:00Z' };
}

function buildChannel(): { mock: ChannelMock; channel: Channel } {
  const mock: ChannelMock = {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockReturnValue(true),
  };
  return { mock, channel: mock as unknown as Channel };
}

describe('RabbitMQEventPublisher', () => {
  it('llama assertExchange con tipo topic y durable:true', async () => {
    const { mock, channel } = buildChannel();
    const publisher = new RabbitMQEventPublisher(channel);

    await publisher.publish('move.events', 'reservation.unclassified', fakeEvent());

    expect(mock.assertExchange).toHaveBeenCalledWith('move.events', 'topic', { durable: true });
  });

  it('serializa el evento como Buffer JSON con persistent:true', async () => {
    const { mock, channel } = buildChannel();
    const publisher = new RabbitMQEventPublisher(channel);
    const event = fakeEvent();

    await publisher.publish('move.events', 'reservation.unclassified', event);

    expect(mock.publish).toHaveBeenCalledTimes(1);
    const calls = mock.publish.mock.calls as PublishCall[];
    const buf = calls[0]?.[2];
    const opts = calls[0]?.[3];
    expect(JSON.parse(buf.toString())).toEqual(event);
    expect(opts).toEqual({ persistent: true });
  });

  it('usa el routingKey recibido en la llamada a channel.publish', async () => {
    const { mock, channel } = buildChannel();
    const publisher = new RabbitMQEventPublisher(channel);

    await publisher.publish('move.events', 'custom.routing.key', fakeEvent());

    const calls = mock.publish.mock.calls as PublishCall[];
    expect(calls[0]?.[1]).toBe('custom.routing.key');
  });

  it('usa el exchange recibido en la llamada a channel.publish', async () => {
    const { mock, channel } = buildChannel();
    const publisher = new RabbitMQEventPublisher(channel);

    await publisher.publish('other.exchange', 'some.key', fakeEvent());

    const calls = mock.publish.mock.calls as PublishCall[];
    expect(calls[0]?.[0]).toBe('other.exchange');
  });
});
