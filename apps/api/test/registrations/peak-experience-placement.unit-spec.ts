import assert from "node:assert/strict";
import test from "node:test";

import {
  qualifiesForPeakExperienceAutoApproval,
  readTourMinRequiredPeaks,
  readUserPastPeaksCount,
} from "../../src/modules/registrations/utils/peak-experience-placement";

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
