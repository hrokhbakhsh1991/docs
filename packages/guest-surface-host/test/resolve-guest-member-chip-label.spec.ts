import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveGuestMemberChipLabel } from "../src/resolve-guest-member-chip-label";

describe("resolveGuestMemberChipLabel", () => {
  it("GL-BRAND-03 prefers a chosen personal name", () => {
    assert.equal(
      resolveGuestMemberChipLabel({
        displayName: "  تست مهمان  ",
        mobile: "+989128881147",
        fallback: "عضو",
      }),
      "تست مهمان"
    );
  });

  it("GL-BRAND-03 empty name uses i18n fallback, not Member or mobile", () => {
    assert.equal(
      resolveGuestMemberChipLabel({
        displayName: null,
        mobile: "+989128881147",
        fallback: "عضو",
      }),
      "عضو"
    );
    assert.equal(
      resolveGuestMemberChipLabel({
        displayName: "   ",
        mobile: null,
        fallback: "عضو",
      }),
      "عضو"
    );
  });

  it("GL-BRAND-03 treats English placeholder Member as unnamed", () => {
    assert.equal(
      resolveGuestMemberChipLabel({
        displayName: "Member",
        mobile: "+989128881147",
        fallback: "عضو",
      }),
      "عضو"
    );
  });

  it("GL-BRAND-03 treats identity mobile stuffed into displayName as unnamed", () => {
    assert.equal(
      resolveGuestMemberChipLabel({
        displayName: "+989128881147",
        mobile: "+989128881147",
        fallback: "عضو",
      }),
      "عضو"
    );
  });

  it("GL-BRAND-03 English locale fallback may be Member", () => {
    assert.equal(
      resolveGuestMemberChipLabel({
        displayName: "",
        fallback: "Member",
      }),
      "Member"
    );
  });
});
