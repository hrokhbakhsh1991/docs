/**
 * Photo error codec must stay canonical in workspace-denali (WEB-P11-6-04).
 * Gap Closure B.6 — shell binder uses dynamic import(); no static product fan-in.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("denali-photo-error-reexport.spec.ts", () => {
  it("WEB-P11-6-04 web photo bindings delegate to denali photo-upload-errors surface only", () => {
    const source = readFileSync(
      join(WEB_ROOT, "src/bootstrap/workspace-photo-upload-errors-bindings.generated.ts"),
      "utf8"
    );
    assert.match(
      source,
      /await import\("@app-tour\/workspace-denali\/host\/ui\/adapters\/photo-upload-errors-surface"\)/
    );
    assert.doesNotMatch(
      source,
      /(?:import|export)\s+\{[^}]*\}\s+from\s+"@app-tour\/workspace-denali\/host\/ui\/adapters\/photo-upload-errors-surface"/
    );
    assert.match(source, /ensurePhotoUploadErrorsSurface/);
    assert.doesNotMatch(source, /PHOTO_ERROR_CODE_ALIASES/);
    assert.doesNotMatch(source, /function extractDenaliPhotoApiErrorCode/);
  });
});
