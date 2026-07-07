/**
 * PS-6 — embedded member portal host detection.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isEmbeddedMemberPortalHost,
  resolveEmbeddedMemberPortalHost,
} from "../src/embedded/resolve-embedded-member-portal-host";

describe("resolve-embedded-member-portal-host.spec.ts — GSH PS-6", () => {
  it("GSH-PS6-01 returns null for normal browser UA", () => {
    assert.equal(
      resolveEmbeddedMemberPortalHost({ userAgent: "Mozilla/5.0 Chrome/120" }),
      null
    );
    assert.equal(isEmbeddedMemberPortalHost(null), false);
  });

  it("GSH-PS6-02 detects Telegram user agent", () => {
    assert.equal(
      resolveEmbeddedMemberPortalHost({ userAgent: "TelegramBot/1.0" }),
      "telegram"
    );
    assert.equal(isEmbeddedMemberPortalHost("telegram"), true);
  });

  it("GSH-PS6-03 dev tgWebApp override when not production", () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "test";
    try {
      assert.equal(
        resolveEmbeddedMemberPortalHost({ searchParams: { tgWebApp: "1" } }),
        "telegram"
      );
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
