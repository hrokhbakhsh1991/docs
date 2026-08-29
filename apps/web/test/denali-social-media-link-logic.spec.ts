/**
 * Denali social media link normalization
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DENALI_SOCIAL_MEDIA_EXTERNAL_PENDING,
  formatSocialMediaLinkForReview,
  isSocialMediaLinkWizardSatisfied,
  normalizeSocialMediaLink,
  stripSocialMediaLinkForSubmit,
} from "@app-tour/workspace-denali/host/ui/logic/denali-social-media-link-logic";

describe("denali-social-media-link-logic.spec.ts", () => {
  it("WEB-DENALI-SOCIAL-01 normalizes http/https URLs", () => {
    const telegram = normalizeSocialMediaLink("https://t.me/mychannel");
    assert.equal(telegram.ok, true);
    if (telegram.ok) {
      assert.equal(telegram.value, "https://t.me/mychannel");
    }

    const instagram = normalizeSocialMediaLink("instagram.com/acme");
    assert.equal(instagram.ok, true);
    if (instagram.ok) {
      assert.equal(instagram.value, "https://instagram.com/acme");
    }
  });

  it("WEB-DENALI-SOCIAL-02 rejects invalid URLs", () => {
    assert.equal(normalizeSocialMediaLink("not a url").ok, false);
    assert.equal(normalizeSocialMediaLink("ftp://example.com").ok, false);
  });

  it("WEB-DENALI-SOCIAL-03 empty link is optional and clears on submit", () => {
    assert.equal(normalizeSocialMediaLink("").ok, true);
    assert.equal(isSocialMediaLinkWizardSatisfied(""), true);
    assert.equal(formatSocialMediaLinkForReview(""), "");
    assert.equal(stripSocialMediaLinkForSubmit(DENALI_SOCIAL_MEDIA_EXTERNAL_PENDING), "");
  });

  it("WEB-DENALI-SOCIAL-04 review shows stored URL only", () => {
    assert.equal(
      formatSocialMediaLinkForReview("https://example.com/group"),
      "https://example.com/group"
    );
  });
});
