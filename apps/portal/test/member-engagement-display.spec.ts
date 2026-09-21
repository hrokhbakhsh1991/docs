import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { formatMemberEngagementTimestamp } from "@/me/engagement/member-engagement-display";

describe("member engagement display", () => {
  it("formats history timestamps with a deterministic timezone", () => {
    const iso = "2026-09-21T00:30:00.000Z";
    const expected = new Intl.DateTimeFormat("fa-IR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(iso));

    assert.equal(formatMemberEngagementTimestamp(iso, "fa-IR"), expected);
  });
});
