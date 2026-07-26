/**
 * Thin Shell Phase 4ay — orphaned photo-upload-errors binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-photo-upload-errors-binder — Phase 4ay", () => {
  it("TS-4AY-01 web photo-upload-errors binder deleted", () => {
    const binder = resolve(
      WEB_ROOT,
      "src/bootstrap/workspace-photo-upload-errors-bindings.generated.ts"
    );
    assert.equal(existsSync(binder), false);
  });

  it("TS-4AY-02 platform photo client does not import binder helpers", () => {
    const client = readFileSync(
      resolve(WEB_ROOT, "src/wizard/platform/platform-photo-upload-client.ts"),
      "utf8"
    );
    assert.doesNotMatch(client, /workspace-photo-upload-errors-bindings/);
    assert.doesNotMatch(client, /ensurePhotoUploadErrorsSurface/);
    assert.doesNotMatch(client, /resolvePhotoUploadErrorsSurface/);
  });

  it("TS-4AY-03 package photo surface remains codec SOT", () => {
    const surface = readFileSync(
      resolve(
        WEB_ROOT,
        "../../packages/workspaces/denali/src/ui/adapters/photo-upload-errors-surface.ts"
      ),
      "utf8"
    );
    assert.match(surface, /denaliPhotoUploadErrorsSurface/);
    assert.match(surface, /resolveDenaliPhotoUploadError/);
  });
});
