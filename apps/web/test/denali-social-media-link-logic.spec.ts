/**
 * Denali social media link normalization
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectSocialMediaKind,
  formatTelegramInputDisplay,
  normalizeExternalSocialLink,
  normalizeSocialMediaLinkForKind,
  normalizeTelegramSocialLink,
} from "@app-tour/workspace-denali/ui/logic/denali-social-media-link-logic";

describe("denali-social-media-link-logic.spec.ts", () => {
  it("WEB-DENALI-SOCIAL-01 detects telegram vs other links", () => {
    assert.equal(detectSocialMediaKind(""), "telegram");
    assert.equal(detectSocialMediaKind("https://t.me/mychannel"), "telegram");
    assert.equal(detectSocialMediaKind("@mychannel"), "telegram");
    assert.equal(detectSocialMediaKind("https://instagram.com/acme"), "other");
  });

  it("WEB-DENALI-SOCIAL-02 normalizes telegram handles without full URL", () => {
    assert.equal(normalizeTelegramSocialLink("@mychannel"), "https://t.me/mychannel");
    assert.equal(normalizeTelegramSocialLink("mychannel"), "https://t.me/mychannel");
    assert.equal(
      normalizeTelegramSocialLink("https://t.me/mychannel/123"),
      "https://t.me/mychannel"
    );
    assert.equal(formatTelegramInputDisplay("https://t.me/mychannel"), "@mychannel");
  });

  it("WEB-DENALI-SOCIAL-03 requires full URL for non-telegram networks", () => {
    assert.equal(normalizeExternalSocialLink("instagram.com/acme"), "https://instagram.com/acme");
    assert.equal(normalizeExternalSocialLink("https://t.me/channel"), null);
    assert.equal(normalizeExternalSocialLink("not a url"), null);
    const other = normalizeSocialMediaLinkForKind("other", "https://example.com/tour");
    assert.equal(other.ok, true);
    if (other.ok) {
      assert.equal(other.value, "https://example.com/tour");
    }
  });
});
