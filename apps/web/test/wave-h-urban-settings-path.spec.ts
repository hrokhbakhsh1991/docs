/**
 * Wave H.i.b — /settings/workspace-owner is canonical; /settings/urban redirects.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  URBAN_SETTINGS_PAGE_PATH,
  URBAN_SETTINGS_PAGE_PATH_LEGACY,
} from "../../../docs/phase-8/appendices/CANLOAD-URBAN-SETTINGS.contract";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

describe("Wave H.i.b — workspace-owner settings path", () => {
  it("H.i.b-01 contract + filesystem use workspace-owner", () => {
    assert.equal(URBAN_SETTINGS_PAGE_PATH, "/settings/workspace-owner");
    assert.equal(URBAN_SETTINGS_PAGE_PATH_LEGACY, "/settings/urban");
    assert.equal(existsSync(join(WEB_ROOT, "app/(app)/settings/workspace-owner")), true);
    assert.equal(existsSync(join(WEB_ROOT, "app/(app)/settings/urban")), false);
  });

  it("H.i.b-02 manifest nav + operatorShellNav capability use workspace-owner", () => {
    const manifest = readFileSync(
      join(REPO_ROOT, "packages/workspaces/urban/workspace.manifest.json"),
      "utf8"
    );
    assert.match(manifest, /\/settings\/workspace-owner/);
    assert.match(manifest, /workspaceOwnerSettings/);
    assert.doesNotMatch(manifest, /\/settings\/urban"/);
    assert.equal(
      existsSync(join(WEB_ROOT, "src/bootstrap/operator-shell-nav-bindings.generated.ts")),
      false
    );
    const registry = readFileSync(
      join(WEB_ROOT, "src/shell/operator-shell-nav-registry.ts"),
      "utf8"
    );
    assert.match(registry, /resolveOperatorShellNavCapability/);
  });
});
