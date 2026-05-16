/**
 * Future transport port (Kafka/Rabbit/SNS). **Not** wired to real brokers in this slice.
 *
 * Implementations must treat delivery as **at-least-once**; consumers remain **idempotent**.
 */
export interface IOutboxPublisher {
  publish(outboxId: string, eventType: string, payload: Record<string, unknown>): Promise<void>;
}
