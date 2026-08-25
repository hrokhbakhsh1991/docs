/**
 * P5-B-N-008 — catalog ref integrity (VAL-03)
 * @see docs/phase-18/platform-denali-operator-parity.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createCanonicalDocument } from "@app-tour/workspace-sdk";

import {
  assertCatalogRefIntegrity,
  type CatalogRefAllowlists,
} from "../src/canonical/assert-catalog-ref-integrity.ts";
import { resolveDenaliCatalogRefAllowlists } from "../src/canonical/resolve-denali-catalog-ref-allowlists.ts";
import { getIdentityRepository } from "../src/identity/create-identity-repository.ts";
import { getSettingsResourcesRepository } from "../src/settings/create-settings-resources-repository.ts";
import { installMemoryStorageDriverForDescribe } from "./test-helpers.ts";

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const TENANT_ID = "00000000-0000-4000-8000-000000000040";

const ALLOWLISTS: CatalogRefAllowlists = {
  activeThemeIds: ["theme-valid"],
  selectableLeaderIds: ["leader-valid"],
};

installMemoryStorageDriverForDescribe();

function themeSeed(id: string, isActive = true) {
  const now = new Date().toISOString();
  return {
    id,
    tenantId: TENANT_ID,
    name: `Theme ${id}`,
    slug: id,
    formProfile: "mountain_outdoor",
    isActive,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  };
}

describe("catalog-ref-integrity (P5-B VAL-03)", () => {
  before(async () => {
    const settingsRepo = getSettingsResourcesRepository();
    await settingsRepo.seedTourTheme(themeSeed("theme-valid", true));
    await settingsRepo.seedTourTheme(themeSeed("theme-inactive", false));

    const identityRepo = getIdentityRepository();
    identityRepo.seedUser({
      id: "leader-valid",
      mobile: "+9891200000401",
    });
    identityRepo.seedMembership({
      userId: "leader-valid",
      tenantId: TENANT_ID,
      role: "member",
      status: "ACTIVE",
      sessionVersion: 1,
      workspaceId: "ws-catalog-ref",
      rewards: { isSelectableLeader: true },
    });
  });

  it("VAL-03 invalid theme id fails publish integrity assert", () => {
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["program", "leaderUserIds", "publishStatus"],
      data: {
        publishStatus: "active",
        program: { themeIds: ["theme-valid", "theme-stale"] },
        leaderUserIds: ["leader-valid"],
      },
    });

    const violation = assertCatalogRefIntegrity(document, ALLOWLISTS);
    assert.ok(violation);
    assert.equal(violation?.code, "CATALOG_REF_INTEGRITY_FAILED");
    assert.match(violation?.message ?? "", /program\.themeIds:theme-stale/);
  });

  it("VAL-03b invalid leader id fails publish integrity assert", () => {
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["program", "leaderUserIds"],
      data: {
        program: { themeIds: ["theme-valid"] },
        leaderUserIds: ["leader-valid", "leader-stale"],
      },
    });

    const violation = assertCatalogRefIntegrity(document, ALLOWLISTS);
    assert.ok(violation);
    assert.match(violation?.message ?? "", /leaderUserIds:leader-stale/);
  });

  it("VAL-03c valid catalog refs pass integrity assert", () => {
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: ["program", "leaderUserIds"],
      data: {
        program: { themeIds: ["theme-valid"] },
        leaderUserIds: ["leader-valid"],
      },
    });

    assert.equal(assertCatalogRefIntegrity(document, ALLOWLISTS), null);
  });

  it("VAL-03d resolveDenaliCatalogRefAllowlists loads active themes and selectable leaders", async () => {
    const allowlists = await resolveDenaliCatalogRefAllowlists(TENANT_ID);
    assert.deepEqual(allowlists.activeThemeIds, ["theme-valid"]);
    assert.deepEqual(allowlists.selectableLeaderIds, ["leader-valid"]);
  });

  it("VAL-03e workspace validation pipeline wires catalog assert on publish", () => {
    const source = readFileSync(
      join(apiRoot, "src/tours/run-workspace-validation-pipeline.ts"),
      "utf8"
    );
    assert.match(source, /assertCatalogRefIntegrity/);
    assert.match(source, /catalogRefAllowlists/);
  });

  it("VAL-03f validateCanonicalBeforePersist enriches catalog allowlists via dispatch", () => {
    const source = readFileSync(join(apiRoot, "src/tours/canonical-validation.ts"), "utf8");
    assert.match(source, /resolveCatalogRefAllowlistsForWorkspace/);
    assert.match(source, /catalogRefAllowlists/);
    assert.doesNotMatch(source, /workspaceType !== "denali"/);
  });
});
