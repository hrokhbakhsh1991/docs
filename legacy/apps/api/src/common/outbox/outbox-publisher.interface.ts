/**
 * Future transport port (Kafka/Rabbit/SNS). **Not** wired to real brokers in this slice.
 *
 * Implementations must treat delivery as **at-least-once**; consumers remain **idempotent**.
 */
export interface IOutboxPublisher {
  publish(_outboxId: string, _eventType: string, _payload: Record<string, unknown>): Promise<void>;
}
