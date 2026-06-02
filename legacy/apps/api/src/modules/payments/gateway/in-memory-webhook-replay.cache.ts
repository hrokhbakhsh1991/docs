import type { WebhookReplayCache } from "./webhook-signature.verify";

/** Process-local replay dedupe (fallback when Redis is unavailable). */
export class InMemoryWebhookReplayCache implements WebhookReplayCache {
  private readonly map = new Map<string, number>();

  get(key: string): number | undefined {
    return this.map.get(key);
  }

  set(key: string, seenAtMs: number): void {
    this.map.set(key, seenAtMs);
  }

  deleteExpired(nowMs: number, ttlMs: number): void {
    for (const [key, seenAt] of this.map.entries()) {
      if (nowMs - seenAt > ttlMs) {
        this.map.delete(key);
      }
    }
  }
}
