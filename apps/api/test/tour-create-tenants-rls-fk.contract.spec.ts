/**
 * Contract: atomic tour create must not Prisma-connect `tenants` under app_cloud.
 * @see docs/phase-20/p7/appendices/TOUR_CREATE_TENANTS_RLS_FK.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("tour-create-tenants-rls-fk (TOUR_CREATE_TENANTS_RLS_FK)", () => {
  it("atomic persist uses unchecked tenantId — forbids tenant connect in code", () => {
    const atomic = readFileSync(
      join(apiRoot, "src/canonical/atomic-canonical-tour-persist.ts"),
      "utf8"
    );
    // Strip block + line comments so docstrings mentioning the anti-pattern do not fail the guard.
    const codeOnly = atomic
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.match(codeOnly, /TourUncheckedCreateInput/);
    assert.match(codeOnly, /tenantId:\s*args\.tenantId/);
    assert.doesNotMatch(codeOnly, /tenant:\s*\{\s*connect/);
  });

  it("prisma tour repository create already uses scalar tenantId", () => {
    const repo = readFileSync(join(apiRoot, "src/storage/prisma-tour.repository.ts"), "utf8");
    const codeOnly = repo
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    assert.match(codeOnly, /tenantId:\s*tour\.tenantId/);
    assert.doesNotMatch(codeOnly, /tenant:\s*\{\s*connect/);
  });
});
