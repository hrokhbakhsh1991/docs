/**
 * Wave H.b / H.i.b — src/urban gone; settings under workspace-owner path.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  URBAN_SETTINGS_ACCESS_MODULE,
  URBAN_SETTINGS_PAGE_MODULE,
  URBAN_SETTINGS_PAGE_PATH,
  URBAN_SETTINGS_PAGE_PATH_LEGACY,
} from "../../../docs/phase-8/appendices/CANLOAD-URBAN-SETTINGS.contract";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

describe("Wave H.b — urban settings colocation + src/urban removed", () => {
  it("H.b-01 apps/web/src/urban/ directory is absent", () => {
    assert.equal(existsSync(join(WEB_ROOT, "src/urban")), false);
  });

  it("H.b-02 settings access colocated; owner panel SoT in package (Wave H.i / H.m)", () => {
    assert.equal(
      existsSync(
        join(WEB_ROOT, "app/(app)/settings/workspace-owner/workspace-owner-settings-access.ts")
      ),
      true
    );
    assert.equal(
      existsSync(join(WEB_ROOT, "app/(app)/settings/workspace-owner/urban-settings-access.ts")),
      false
    );
    assert.equal(
      existsSync(join(WEB_ROOT, "app/(app)/settings/urban/urban-owner-settings-panel.tsx")),
      false
    );
  });

  it("H.b-03 Phase 8 contract paths cite workspace-owner modules", () => {
    assert.equal(
      URBAN_SETTINGS_ACCESS_MODULE,
      "apps/web/app/(app)/settings/workspace-owner/workspace-owner-settings-access.ts"
    );
    assert.equal(
      URBAN_SETTINGS_PAGE_MODULE,
      "apps/web/app/(app)/settings/workspace-owner/page.tsx"
    );
  });

  it("H.b-04 catalog fetch + intake idempotency live in workspace-urban", () => {
    assert.equal(
      existsSync(
        join(REPO_ROOT, "packages/workspaces/urban/src/catalog/fetch-urban-catalog.ts")
      ),
      true
    );
    assert.equal(
      existsSync(
        join(
          REPO_ROOT,
          "packages/workspaces/urban/src/catalog/build-urban-intake-idempotency-key.ts"
        )
      ),
      true
    );
  });
});

describe("Wave H.i.b — urban settings path neutralized", () => {
  it("H.i.b-01 canonical path is /settings/workspace-owner; legacy redirects", () => {
    assert.equal(URBAN_SETTINGS_PAGE_PATH, "/settings/workspace-owner");
    assert.equal(URBAN_SETTINGS_PAGE_PATH_LEGACY, "/settings/urban");
    assert.equal(existsSync(join(WEB_ROOT, "app/(app)/settings/urban")), false);
    assert.equal(existsSync(join(WEB_ROOT, "app/(app)/settings/workspace-owner/page.tsx")), true);
    const nextConfig = readFileSync(join(WEB_ROOT, "next.config.ts"), "utf8");
    assert.match(nextConfig, /source:\s*["']\/settings\/urban["']/);
    assert.match(nextConfig, /destination:\s*["']\/settings\/workspace-owner["']/);
  });
});
