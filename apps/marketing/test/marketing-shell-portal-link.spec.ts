/**
 * PCMS-03 — marketing shell static portal member link contract.
 * @see docs/standards/member-session-portal-authority.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const marketingRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("marketing shell — PCMS-03", () => {
  it("MKT-PCMS-01 shell sign-in navigates to portal login URL (not marketing modal)", () => {
    const shell = readFileSync(path.join(marketingRoot, "src/shell/marketing-shell.tsx"), "utf8");
    assert.match(shell, /data-marketing-portal-member/);
    assert.match(shell, /data-marketing-header-sign-in/);
    assert.match(shell, /portalMemberLoginUrl/);
    assert.match(shell, /href=\{portalMemberLoginUrl\}/);
    assert.doesNotMatch(shell, /MarketingLoginModalTrigger/);
    assert.doesNotMatch(shell, /openLoginModal/);
    assert.doesNotMatch(shell, /resolvePortalMemberAreaUrl/);
  });

  it("MKT-PCMS-02 layout resolves portal login + member module + origin adapter URLs", () => {
    const layout = readFileSync(path.join(marketingRoot, "app/layout.tsx"), "utf8");
    assert.match(layout, /resolvePortalMemberLoginUrl/);
    assert.match(layout, /portalMemberLoginUrl=/);
    assert.match(layout, /resolvePortalMemberModuleUrl/);
    assert.match(layout, /portalMemberModuleUrl=/);
    assert.match(layout, /resolvePortalPublicBaseUrl/);
    assert.match(layout, /MarketingLoginModalProvider/);
    assert.match(layout, /resolveMemberLoginCatalogTourId/);
    assert.doesNotMatch(layout, /resolvePortalMemberAreaUrl/);
  });
});
