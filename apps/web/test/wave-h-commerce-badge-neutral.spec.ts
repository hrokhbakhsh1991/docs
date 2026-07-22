/**
 * Wave H.f — ClubCommerceBadge Denali UX literals removed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BADGE = join(WEB_ROOT, "src/platform/club-commerce-badge.tsx");

describe("Wave H.f — commerce badge neutralization", () => {
  it("H.f-01 no Denali product names in badge module", () => {
    const source = readFileSync(BADGE, "utf8");
    assert.doesNotMatch(source, /Denali|isDenaliWorkspaceType|denali-frozen/i);
    assert.match(source, /isWorkspaceCommerceFrozen/);
    assert.match(source, /data-commerce-frozen=/);
  });
});
