/**
 * Photo error codec must stay canonical in workspace-denali (WEB-P11-6-04)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("denali-photo-error-reexport.spec.ts", () => {
  it("WEB-P11-6-04 web i18n shim re-exports denali photo-upload-errors only", () => {
    const source = readFileSync(
      join(WEB_ROOT, "src/i18n/resolve-denali-photo-upload-error.ts"),
      "utf8"
    );
    assert.match(source, /from "@app-tour\/workspace-denali\/ui\/adapters\/photo-upload-errors"/);
    assert.doesNotMatch(source, /PHOTO_ERROR_CODE_ALIASES/);
    assert.doesNotMatch(source, /function extractDenaliPhotoApiErrorCode/);
  });
});
