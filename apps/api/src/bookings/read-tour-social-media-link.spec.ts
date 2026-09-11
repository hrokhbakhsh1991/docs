import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readTourSocialMediaLink } from "./read-tour-social-media-link";

describe("readTourSocialMediaLink", () => {
  it("normalizes the canonical root link for approval/public egress", () => {
    assert.equal(
      readTourSocialMediaLink({ socialMediaLink: "instagram.com/denali.club" }),
      "https://instagram.com/denali.club"
    );
  });

  it("supports the legacy nested basicInfo location", () => {
    assert.equal(
      readTourSocialMediaLink({ basicInfo: { socialMediaLink: "https://t.me/denali" } }),
      "https://t.me/denali"
    );
  });

  it("does not expose invalid protocols or empty values", () => {
    assert.equal(readTourSocialMediaLink({ socialMediaLink: "javascript:alert(1)" }), null);
    assert.equal(readTourSocialMediaLink({ socialMediaLink: "" }), null);
  });
});
