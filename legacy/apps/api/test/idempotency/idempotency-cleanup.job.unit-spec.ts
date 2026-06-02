import assert from "node:assert/strict";
import test from "node:test";
import { IdempotencyCleanupJob } from "../../src/jobs/idempotency-cleanup.job";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

test("idempotency cleanup job calls deleteExpiredWithManager per tenant on interval tick", async () => {
  let deleteCalls = 0;
  const idempotencyService = {
    async deleteExpiredWithManager(): Promise<number> {
      deleteCalls += 1;
      return 3;
    }
  };

  let scheduledCallback: (() => void) | undefined;
  let scheduledStartup: (() => void) | undefined;
  const originalSetInterval = global.setInterval;
  const originalSetTimeout = global.setTimeout;
  const originalClearInterval = global.clearInterval;

  const fakeTimer = {
    unref() {
      return this;
    }
  } as unknown as NodeJS.Timeout;

  global.setInterval = (((callback: unknown) => {
    scheduledCallback = callback as () => void;
    return fakeTimer;
  }) as unknown) as typeof setInterval;
  global.setTimeout = (((callback: unknown) => {
    scheduledStartup = callback as () => void;
    return fakeTimer;
  }) as unknown) as typeof setTimeout;

  global.clearInterval = (() => undefined) as typeof clearInterval;

  try {
    const job = new IdempotencyCleanupJob(
      idempotencyService as never,
      {
        shouldRunSchedulers: () => true,
        getSchedulerJitterMs: () => 0
      } as never,
      { query: async () => [] } as never,
      {
        runInTenantScope: async (_tenantId: string, fn: (_manager: unknown) => Promise<number>) =>
          fn({})
      } as never,
      {
        find: async () => [{ id: TENANT_A }, { id: TENANT_B }]
      } as never,
      {
        runWithGlobalLock: async (_name: string, onLocked: () => Promise<void>) => {
          await onLocked();
          return { acquired: true };
        }
      } as never,
      {
        noteStarted: () => undefined,
        noteFinished: () => undefined,
        noteFailed: () => undefined,
        noteSkippedDueLock: () => undefined
      } as never
    );
    job.onModuleInit();
    scheduledStartup?.();
    assert.ok(scheduledCallback);
    scheduledCallback?.();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(deleteCalls, 4);
    job.onModuleDestroy();
  } finally {
    global.setInterval = originalSetInterval;
    global.setTimeout = originalSetTimeout;
    global.clearInterval = originalClearInterval;
  }
});
