/**
 * P6-3 — portal home session redirect
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("portal-home-redirect", () => {
  it("MEM-HOME-01 session redirects to /me/registrations", () => {
    const page = readFileSync(join(repoRoot, "apps/portal/app/page.tsx"), "utf8");
    assert.match(page, /readPublicCatalogSessionFromCookies/);
    assert.match(page, /\/me\/registrations/);
  });
});
