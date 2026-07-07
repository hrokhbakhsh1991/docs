import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isDenaliExposureReminderSchedulerEnabled,
  readDenaliExposureReminderSchedulerPollIntervalMs,
} from "../src/exposure/start-denali-exposure-reminder-scheduler";

describe("denali exposure reminder scheduler config", () => {
  it("is disabled unless explicitly enabled", () => {
    const previous = process.env.DENALI_EXPOSURE_REMINDER_SCHEDULER_ENABLED;
    delete process.env.DENALI_EXPOSURE_REMINDER_SCHEDULER_ENABLED;
    assert.equal(isDenaliExposureReminderSchedulerEnabled(), false);
    process.env.DENALI_EXPOSURE_REMINDER_SCHEDULER_ENABLED = "true";
    assert.equal(isDenaliExposureReminderSchedulerEnabled(), true);
    if (previous === undefined) {
      delete process.env.DENALI_EXPOSURE_REMINDER_SCHEDULER_ENABLED;
    } else {
      process.env.DENALI_EXPOSURE_REMINDER_SCHEDULER_ENABLED = previous;
    }
  });

  it("defaults poll interval to 60s with a 5s floor", () => {
    const previous = process.env.DENALI_EXPOSURE_REMINDER_SCHEDULER_POLL_MS;
    delete process.env.DENALI_EXPOSURE_REMINDER_SCHEDULER_POLL_MS;
    assert.equal(readDenaliExposureReminderSchedulerPollIntervalMs(), 60_000);
    process.env.DENALI_EXPOSURE_REMINDER_SCHEDULER_POLL_MS = "1000";
    assert.equal(readDenaliExposureReminderSchedulerPollIntervalMs(), 5_000);
    if (previous === undefined) {
      delete process.env.DENALI_EXPOSURE_REMINDER_SCHEDULER_POLL_MS;
    } else {
      process.env.DENALI_EXPOSURE_REMINDER_SCHEDULER_POLL_MS = previous;
    }
  });
});
