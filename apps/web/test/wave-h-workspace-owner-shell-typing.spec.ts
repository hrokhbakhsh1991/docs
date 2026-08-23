/**
 * Wave H.m — workspace-owner shell typing (no Urban chrome names on the route).
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolveUrbanSettingsPageBranch,
  URBAN_SETTINGS_ACCESS_MODULE,
} from "../../../docs/phase-8/appendices/CANLOAD-URBAN-SETTINGS.contract";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROUTE = join(WEB_ROOT, "app/(app)/settings/workspace-owner");

describe("Wave H.m — workspace-owner shell typing", () => {
  it("H.m-01 access module is product-blind filename", () => {
    assert.equal(
      URBAN_SETTINGS_ACCESS_MODULE,
      "apps/web/app/(app)/settings/workspace-owner/workspace-owner-settings-access.ts"
    );
    assert.equal(existsSync(join(ROUTE, "workspace-owner-settings-access.ts")), true);
    assert.equal(existsSync(join(ROUTE, "urban-settings-access.ts")), false);
  });

  it("H.m-02 page uses WorkspaceOwner* names + settings.workspaceOwner", () => {
    const page = readFileSync(join(ROUTE, "page.tsx"), "utf8");
    assert.match(page, /export default async function WorkspaceOwnerSettingsPage/);
    assert.match(page, /loadWorkspaceOwnerSettingsPanel/);
    assert.match(page, /settings\.workspaceOwner/);
    assert.doesNotMatch(page, /export default async function UrbanSettingsPage/);
    assert.doesNotMatch(page, /\bUrbanOwnerSettingsPanel\b/);
    assert.doesNotMatch(page, /getTranslations\(["']settings\.urban["']\)/);
    assert.doesNotMatch(page, /@app-cloud\/workspace-urban/);
  });

  it("H.m-02b page binds access workspaceType from the resolved session", () => {
    const page = readFileSync(join(ROUTE, "page.tsx"), "utf8");
    assert.match(page, /const workspaceType = resolved\.session\.pluginId/);
    assert.doesNotMatch(page, /:\s*["']starter["']/);
    assert.doesNotMatch(
      page,
      /workspaceType\s*=\s*[\s\S]{0,120}\?\s*[\s\S]{0,120}:\s*["']starter["']/
    );
  });

  it("H.m-03 canLoad allowed branch render token is WorkspaceOwnerSettingsPanel", () => {
    const branch = resolveUrbanSettingsPageBranch({
      authz: {
        canPerformWorkspaceOwnerMutation: () => true,
      },
      tenantId: "00000000-0000-4000-8000-000000000004",
      workspaceId: "00000000-0000-4000-8000-000000000403",
      workspaceType: "urban",
      pluginId: "urban",
    });
    assert.equal(branch.kind, "allowed");
    if (branch.kind === "allowed") {
      assert.equal(branch.render, "WorkspaceOwnerSettingsPanel");
    }
  });
});
