import type { OutboxService } from "../../src/modules/outbox/outbox.service";

/** Test double: satisfies {@link OutboxService} for ledger unit tests (no DB). */
export const noopOutboxServiceForTests = {
  async addEvent(): Promise<void> {}
} as unknown as OutboxService;
