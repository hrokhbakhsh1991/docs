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
  it("MKT-PCMS-01 shell exposes static portal member area link", () => {
    const shell = readFileSync(path.join(marketingRoot, "src/shell/marketing-shell.tsx"), "utf8");
    assert.match(shell, /data-marketing-portal-member/);
    assert.match(shell, /portalMemberModuleUrl/);
    assert.doesNotMatch(shell, /resolvePortalMemberAreaUrl/);
  });

  it("MKT-PCMS-02 layout resolves portal member module URL", () => {
    const layout = readFileSync(path.join(marketingRoot, "app/layout.tsx"), "utf8");
    assert.match(layout, /resolvePortalMemberModuleUrl/);
    assert.match(layout, /portalMemberModuleUrl=/);
    assert.doesNotMatch(layout, /resolvePortalMemberAreaUrl/);
  });
});
