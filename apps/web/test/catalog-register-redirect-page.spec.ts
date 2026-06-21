/**
 * P4-B — web catalog register redirect shim (no duplicate flow)
 * @see docs/phase-17/platform-portal-registration.mdoc (PR-06)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const PAGE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../app/(public)/catalog/[tourId]/register/page.tsx"
);

describe("catalog-register-redirect-page (P4-B PR-06)", () => {
  it("PR-06 register page is redirect-only shim to portal", () => {
    const source = readFileSync(PAGE_PATH, "utf8");
    assert.match(source, /redirect\(/);
    assert.match(source, /resolvePortalRegistrationRedirectUrl/);
    assert.doesNotMatch(source, /PublicCatalogRegistrationFlow/);
  });
});
