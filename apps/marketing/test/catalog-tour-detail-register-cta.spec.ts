import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("catalog-tour-detail-register-cta — PCMS tour sign-in", () => {
  it("MKT-PCMS-03 exposes secondary tour sign-in link", () => {
    const cta = readFileSync(
      join(repoRoot, "apps/marketing/src/catalog/catalog-tour-detail-register-cta.tsx"),
      "utf8"
    );
    assert.match(cta, /data-marketing-tour-sign-in/);
    assert.match(cta, /tourSignInUrl/);
    assert.match(cta, /signInToRegister/);
  });
});
