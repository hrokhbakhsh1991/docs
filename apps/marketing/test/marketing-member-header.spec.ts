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

  it("MKT-PCMS-04 shell shows profile chip when authenticated", () => {
    const shell = readFileSync(path.join(marketingRoot, "src/shell/marketing-shell.tsx"), "utf8");
    assert.match(shell, /memberHeader !== null/);
    assert.match(shell, /data-marketing-header-member/);
    assert.match(shell, /data-marketing-member-authenticated/);
    assert.match(shell, /memberHeader\.profileHref/);
    assert.match(shell, /data-marketing-header-member-meta/);
    assert.match(shell, /data-marketing-header-member-hint/);
    assert.match(shell, /data-marketing-header-member-avatar-wrap/);
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
});
