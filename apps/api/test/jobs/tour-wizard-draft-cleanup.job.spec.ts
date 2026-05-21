import assert from "node:assert/strict";
import test from "node:test";
import { Logger } from "@nestjs/common";
import {
  msUntilNext0300Utc,
  TourWizardDraftCleanupJob,
  TOUR_WIZARD_DRAFT_RETENTION_DAYS,
} from "../../src/jobs/tour-wizard-draft-cleanup.job";

test("msUntilNext0300Utc schedules same-day 03:00 UTC when before cutoff", () => {
  const from = new Date("2026-05-21T01:00:00.000Z");
  const ms = msUntilNext0300Utc(from);
  assert.equal(ms, 2 * 60 * 60 * 1000);
});

test("msUntilNext0300Utc schedules next-day 03:00 UTC when after cutoff", () => {
  const from = new Date("2026-05-21T04:00:00.000Z");
  const ms = msUntilNext0300Utc(from);
  assert.equal(ms, 23 * 60 * 60 * 1000);
});

test("tour wizard draft cleanup job deletes stale rows and logs count", async () => {
  let deleteCalls = 0;
  const draftRepository = {
    createQueryBuilder() {
      return {
        delete() {
          return this;
        },
        from() {
          return this;
        },
        where(sql: string) {
          assert.match(sql, new RegExp(`${TOUR_WIZARD_DRAFT_RETENTION_DAYS} days`));
          return this;
        },
        async execute() {
          deleteCalls += 1;
          return { affected: 3 };
        },
      };
    },
  };

  let scheduledCallback: (() => void) | undefined;
  let scheduledStartup: (() => void) | undefined;
  const originalSetInterval = global.setInterval;
  const originalSetTimeout = global.setTimeout;
  const originalClearInterval = global.clearInterval;
  const originalClearTimeout = global.clearTimeout;
  const originalLoggerLog = Logger.prototype.log;

  const logs: string[] = [];
  const fakeTimer = {
    unref() {
      return this;
    },
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
  global.clearTimeout = (() => undefined) as typeof clearTimeout;
  Logger.prototype.log = ((message: unknown) => {
    logs.push(String(message));
  }) as typeof Logger.prototype.log;

  try {
    const job = new TourWizardDraftCleanupJob(
      draftRepository as never,
      {
        shouldRunSchedulers: () => true,
        getSchedulerJitterMs: () => 0,
      } as never,
      {
        runWithGlobalLock: async (_lockName: string, onLocked: () => Promise<void>) => {
          await onLocked();
          return { acquired: true };
        },
      } as never,
      {
        noteStarted: () => undefined,
        noteFinished: () => undefined,
        noteFailed: () => undefined,
        noteSkippedDueLock: () => undefined,
      } as never,
    );
    job.onModuleInit();
    scheduledStartup?.();
    assert.ok(scheduledCallback);
    scheduledCallback?.();
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(deleteCalls, 2);
    assert.equal(
      logs.some((line) => line.includes("TourWizardDraftCleanupJob: deleted 3")),
      true,
    );

    job.onModuleDestroy();
  } finally {
    global.setInterval = originalSetInterval;
    global.setTimeout = originalSetTimeout;
    global.clearInterval = originalClearInterval;
    global.clearTimeout = originalClearTimeout;
    Logger.prototype.log = originalLoggerLog;
  }
});
