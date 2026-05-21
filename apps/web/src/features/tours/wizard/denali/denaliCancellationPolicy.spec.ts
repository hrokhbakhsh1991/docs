import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliCancellationPolicyText } from "./denaliCancellationPolicy";

test("buildDenaliCancellationPolicyText merges text and structured metrics", () => {
  const text = buildDenaliCancellationPolicyText({
    policiesText: "No refunds after departure.",
    cancellationDeadlineHours: 48,
    cancellationPenaltyPercentage: 100,
  });
  assert.match(text ?? "", /No refunds/);
  assert.match(text ?? "", /48 hours/);
  assert.match(text ?? "", /100% penalty/);
});
