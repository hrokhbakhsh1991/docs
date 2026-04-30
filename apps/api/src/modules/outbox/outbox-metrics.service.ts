import { Injectable } from "@nestjs/common";

/**
 * Lightweight in-process counters for Phase 3 observability.
 * Consumers MUST treat deliveries as idempotent; crashes after publish may duplicate logs downstream.
 */
@Injectable()
export class OutboxMetricsService {
  private pendingTotal = 0;
  private failedTotal = 0;
  private lastBatchLatencyMs = 0;
  private lastBatchProcessedAt: string | null = null;

  setPendingTotal(value: number): void {
    this.pendingTotal = Math.max(0, value);
  }

  incrementFailed(): void {
    this.failedTotal += 1;
  }

  setProcessingLatencyMs(ms: number): void {
    this.lastBatchLatencyMs = ms;
  }

  setLastBatchProcessedAt(iso: string | null): void {
    this.lastBatchProcessedAt = iso;
  }

  /** Approximate gauge updated each processor tick when enqueue happens outside processor. */
  noteEnqueued(): void {
    this.pendingTotal += 1;
  }

  getSnapshot(): {
    outbox_pending_total: number;
    outbox_failed_total: number;
    outbox_processing_latency_ms: number;
    last_batch_processed_at: string | null;
  } {
    return {
      outbox_pending_total: this.pendingTotal,
      outbox_failed_total: this.failedTotal,
      outbox_processing_latency_ms: this.lastBatchLatencyMs,
      last_batch_processed_at: this.lastBatchProcessedAt
    };
  }
}
