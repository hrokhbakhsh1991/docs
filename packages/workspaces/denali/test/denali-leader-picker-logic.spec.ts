import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hasLeaderPickerAvatarUrl,
  leaderDisplayInitials,
  partitionLeaderChipPreview,
  resolveDenaliLeaderPickerDefaultExpanded,
  truncateLeaderDisplayName,
} from "../src/ui/logic/denali-leader-picker-logic";

describe("denali-leader-picker-logic", () => {
  it("builds display initials from names", () => {
    assert.equal(leaderDisplayInitials("علی رضایی"), "عر");
    assert.equal(leaderDisplayInitials("Sara"), "SA");
    assert.equal(leaderDisplayInitials("  "), "?");
    assert.equal(leaderDisplayInitials("Mary Jane Watson"), "MW");
  });

  it("opens picker when nothing selected", () => {
    assert.equal(resolveDenaliLeaderPickerDefaultExpanded(0), true);
    assert.equal(resolveDenaliLeaderPickerDefaultExpanded(2), false);
  });

  it("previews first chips and overflow count", () => {
    const users = [
      { userId: "1", displayName: "A" },
      { userId: "2", displayName: "B" },
      { userId: "3", displayName: "C" },
      { userId: "4", displayName: "D" },
    ];
    assert.deepEqual(partitionLeaderChipPreview(users, 3), {
      visible: users.slice(0, 3),
      overflowCount: 1,
    });
  });

  it("truncates long display names", () => {
    const long = "محمدرضا محمدیان پور";
    assert.equal(truncateLeaderDisplayName(long, 10), "محمدرضا م…");
  });

  it("detects usable leader avatar URLs", () => {
    assert.equal(hasLeaderPickerAvatarUrl("https://cdn.example/avatar.jpg"), true);
    assert.equal(hasLeaderPickerAvatarUrl(null), false);
    assert.equal(hasLeaderPickerAvatarUrl(""), false);
    assert.equal(hasLeaderPickerAvatarUrl("   "), false);
  });
});
