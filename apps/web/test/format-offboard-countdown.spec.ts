import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatOffboardCountdown } from "../src/platform/club-detail/format-offboard-countdown";

describe("formatOffboardCountdown", () => {
  it("shows eligible when past", () => {
    const label = formatOffboardCountdown(new Date(Date.now() - 86400000).toISOString());
    assert.equal(label, "Eligible for purge");
  });

  it("shows days remaining when future", () => {
    const label = formatOffboardCountdown(new Date(Date.now() + 3 * 86400000).toISOString());
    assert.match(label, /day\(s\) until scheduled deletion/);
  });
});
