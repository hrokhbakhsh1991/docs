/**
 * PS-4 — marketing manifest nav static checks
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("marketing-shell-nav.spec.ts — PS-4", () => {
  it("MKT-PS4-01 shell has no FULL_LANDING_NAV_LINKS", () => {
    const shell = readFileSync(join(marketingRoot, "src/shell/marketing-shell.tsx"), "utf8");
    assert.doesNotMatch(shell, /FULL_LANDING_NAV_LINKS/);
    assert.match(shell, /primaryNavLinks/);
  });

  it("MKT-PS4-02 layout resolves manifest nav", () => {
    const layout = readFileSync(join(marketingRoot, "app/layout.tsx"), "utf8");
    assert.match(layout, /resolveMarketingShellNavLinks/);
  });

  it("MKT-PS6-01 marketing nav resolves per-link memberModuleId", () => {
    const nav = readFileSync(
      join(marketingRoot, "src/shell/resolve-marketing-shell-nav.server.ts"),
      "utf8"
    );
    assert.match(nav, /resolvePortalMemberModuleUrl/);
    assert.match(nav, /link\.memberModuleId/);
  });
});
