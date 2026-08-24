/**
 * REM-005 — settings catalog cross-tenant delete isolation (ISO-DB-01).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  InMemorySettingsResourcesRepository,
  SettingsResourceNotFoundError,
} from "../src/settings/in-memory-settings-resources.repository";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_REPO_PATH = path.join(
  REPO_ROOT,
  "src/settings/prisma-settings-resources.repository.ts"
);

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("settings-catalog-tenant-delete-isolation", () => {
  it("ISO-DB-01 repository interface rejects cross-tenant delete by foreign id", async () => {
    const repo = new InMemorySettingsResourcesRepository();
    const created = await repo.createEquipment(TENANT_A, {
      name: "Rope",
      themeIds: [],
    });

    await assert.rejects(
      () => repo.deleteEquipment(TENANT_B, created.id),
      SettingsResourceNotFoundError
    );

    const stillThere = await repo.getEquipment(TENANT_A, created.id);
    assert.notEqual(stillThere, null);
    assert.equal(stillThere?.name, "Rope");
  });

  it("ISO-DB-01 same-tenant delete succeeds", async () => {
    const repo = new InMemorySettingsResourcesRepository();
    const created = await repo.createEquipment(TENANT_A, {
      name: "Harness",
      themeIds: [],
    });

    await repo.deleteEquipment(TENANT_A, created.id);
    assert.equal(await repo.getEquipment(TENANT_A, created.id), null);
  });

  it("ISO-DB-01 prisma repository uses tenantId in deleteMany where", () => {
    const source = readFileSync(PRISMA_REPO_PATH, "utf8");
    const deleteManyHits = source.match(/deleteMany\(\{ where: \{ id: itemId, tenantId \} \}\)/g);
    assert.ok(deleteManyHits !== null && deleteManyHits.length >= 5);
    assert.doesNotMatch(
      source,
      /delete(?:TourTheme|Equipment|GuideLanguage|TourPreset|Destination)\(\{ where: \{ id: itemId \} \}\)/
    );
    assert.match(
      source,
      /workspaceRegion\.deleteMany\(\{ where: \{ id: itemId, tenantId \} \}\)/
    );
  });
});
