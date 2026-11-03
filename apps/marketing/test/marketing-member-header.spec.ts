/**
 * PCMS-03 — marketing authenticated header chrome
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const marketingRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("marketing member header — PCMS-03", () => {
  it("MKT-PCMS-03 layout resolves member header from session probe", () => {
    const layout = readFileSync(path.join(marketingRoot, "app/layout.tsx"), "utf8");
    assert.match(layout, /resolveMarketingMemberHeader/);
    assert.match(layout, /memberHeader=/);
  });

  it("MKT-PCMS-04 shell shows profile chip when authenticated", async () => {
    const { createElement: h } = await import("react");
    const { MarketingShellFrame } = await import("../src/shell/marketing-shell-frame");
    const { MarketingHeaderAccount } = await import("../src/shell/marketing-header-account");
    const { renderSessionUi, PROFILE_HREF } = await import("./fixtures/render-session-ui");
    const html = renderSessionUi(
      h(MarketingShellFrame, {
        initiallyAuthenticated: true,
        children: h(MarketingHeaderAccount, {
          memberHeader: { displayName: "SSR member", profileHref: PROFILE_HREF, avatarUrl: null },
          loginHref: "https://portal.example.test/login",
          variant: "toolbar",
        }),
      })
    );
    for (const marker of [
      "data-marketing-header-member",
      "data-marketing-member-authenticated",
      "data-marketing-header-member-meta",
      "data-marketing-header-member-hint",
      "data-marketing-header-member-avatar-wrap",
    ])
      assert.ok(html.includes(marker));
    assert.ok(html.includes(`href="${PROFILE_HREF}"`));
    assert.ok(html.includes("SSR member"));
  });

  it("MKT-PCMS-05 read-only session probe lives in marketing auth module", () => {
    const session = readFileSync(
      path.join(marketingRoot, "src/auth/read-marketing-member-session.server.ts"),
      "utf8"
    );
    assert.match(session, /readMarketingMemberSessionFromCookies/);
    assert.match(session, /validateSessionTokenAsync/);
    assert.match(session, /readSessionTokenFromCookieHeader/);
    assert.match(session, /headers\(\)/);
    assert.match(session, /SESSION_COOKIE_NAMES\.member/);
  });

  it("MKT-PCMS-06 member header binds session tenant via dev cross-surface host helper", () => {
    const resolver = readFileSync(
      path.join(marketingRoot, "src/shell/resolve-marketing-member-header.server.ts"),
      "utf8"
    );
    assert.match(resolver, /sessionTenantMatchesDevCrossSurfaceHost/);
  });

  it("GL-BRAND-03 marketing person chip uses shared helper, not hardcoded Member", () => {
    const resolver = readFileSync(
      path.join(marketingRoot, "src/shell/resolve-marketing-member-header.server.ts"),
      "utf8"
    );
    assert.match(resolver, /resolveGuestMemberChipLabel/);
    assert.match(resolver, /nav\.memberFallback/);
    assert.doesNotMatch(resolver, /["']Member["']/);
  });
});
