/**
 * Photo error codec must stay canonical in workspace-denali (WEB-P11-6-04).
 * Phase 4ay — orphaned web binder deleted; package surface remains SOT.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

describe("denali-photo-error-reexport.spec.ts", () => {
  it("WEB-P11-6-04/4ay web photo binder deleted; package surface owns codec", () => {
    const binder = join(
      WEB_ROOT,
      "src/bootstrap/workspace-photo-upload-errors-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);

    const surface = readFileSync(
      join(
        REPO_ROOT,
        "packages/workspaces/denali/src/ui/adapters/photo-upload-errors-surface.ts"
      ),
      "utf8"
    );
    assert.match(surface, /denaliPhotoUploadErrorsSurface/);
    assert.match(surface, /resolveDenaliPhotoUploadError/);
    assert.doesNotMatch(surface, /PHOTO_ERROR_CODE_ALIASES/);

    const platformClient = readFileSync(
      join(WEB_ROOT, "src/wizard/platform/platform-photo-upload-client.ts"),
      "utf8"
    );
    assert.doesNotMatch(platformClient, /workspace-photo-upload-errors-bindings/);
  });
});
