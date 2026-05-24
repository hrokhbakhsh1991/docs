import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException } from "@nestjs/common";

import {
  assertTravelerMeetsPeakRequirementOrThrow,
  qualifiesForPeakExperienceAutoApproval,
  readTourMinRequiredPeaks,
  readUserPastPeaksCount,
} from "../../src/modules/registrations/utils/peak-experience-placement";

function peakRequirementErrorCode(err: unknown): string | undefined {
  if (!(err instanceof BadRequestException)) {
    return undefined;
  }
  const body = err.getResponse() as { error?: { code?: string } };
  return body.error?.code;
}

test("readTourMinRequiredPeaks accepts 1–4 on tripDetails.requirements", () => {
  assert.equal(readTourMinRequiredPeaks({ requirements: { minRequiredPeaks: 2 } }), 2);
  assert.equal(readTourMinRequiredPeaks({ requirements: { minRequiredPeaks: 0 } }), undefined);
  assert.equal(readTourMinRequiredPeaks({ requirements: { minRequiredPeaks: 5 } }), undefined);
});

test("qualifiesForPeakExperienceAutoApproval when user meets minimum", () => {
  assert.equal(
    qualifiesForPeakExperienceAutoApproval({
      tripDetails: { requirements: { minRequiredPeaks: 2 } },
      participantMetadata: { userPastPeaksCount: 2 },
    }),
    true,
  );
  assert.equal(
    qualifiesForPeakExperienceAutoApproval({
      tripDetails: { requirements: { minRequiredPeaks: 2 } },
      participantMetadata: { userPastPeaksCount: 4 },
    }),
    true,
  );
});

test("qualifiesForPeakExperienceAutoApproval fails when below minimum or tour unset", () => {
  assert.equal(
    qualifiesForPeakExperienceAutoApproval({
      tripDetails: { requirements: { minRequiredPeaks: 3 } },
      participantMetadata: { userPastPeaksCount: 1 },
    }),
    false,
  );
  assert.equal(
    qualifiesForPeakExperienceAutoApproval({
      tripDetails: {},
      participantMetadata: { userPastPeaksCount: 4 },
    }),
    false,
  );
});

test("readUserPastPeaksCount bounds 0–4", () => {
  assert.equal(readUserPastPeaksCount({ userPastPeaksCount: 0 }), 0);
  assert.equal(readUserPastPeaksCount({ userPastPeaksCount: 5 }), undefined);
});

test("assertTravelerMeetsPeakRequirementOrThrow no-op when tour minimum unset", () => {
  assert.doesNotThrow(() =>
    assertTravelerMeetsPeakRequirementOrThrow({}, { userPastPeaksCount: 0 }),
  );
});

test("assertTravelerMeetsPeakRequirementOrThrow passes when user meets minimum", () => {
  assert.doesNotThrow(() =>
    assertTravelerMeetsPeakRequirementOrThrow(
      { requirements: { minRequiredPeaks: 2 } },
      { userPastPeaksCount: 2 },
    ),
  );
  assert.doesNotThrow(() =>
    assertTravelerMeetsPeakRequirementOrThrow(
      { requirements: { minRequiredPeaks: 2 } },
      { userPastPeaksCount: 4 },
    ),
  );
});

test("assertTravelerMeetsPeakRequirementOrThrow rejects below minimum or missing metadata", () => {
  assert.throws(
    () =>
      assertTravelerMeetsPeakRequirementOrThrow(
        { requirements: { minRequiredPeaks: 3 } },
        { userPastPeaksCount: 1 },
      ),
    (err: unknown) => peakRequirementErrorCode(err) === "PEAK_REQUIREMENT_NOT_MET",
  );
  assert.throws(
    () =>
      assertTravelerMeetsPeakRequirementOrThrow({ requirements: { minRequiredPeaks: 2 } }, undefined),
    (err: unknown) => peakRequirementErrorCode(err) === "PEAK_REQUIREMENT_NOT_MET",
  );
  assert.throws(
    () =>
      assertTravelerMeetsPeakRequirementOrThrow(
        { requirements: { minRequiredPeaks: 2 } },
        { userPastPeaksCount: 5 },
      ),
    (err: unknown) => peakRequirementErrorCode(err) === "PEAK_REQUIREMENT_NOT_MET",
  );
});
