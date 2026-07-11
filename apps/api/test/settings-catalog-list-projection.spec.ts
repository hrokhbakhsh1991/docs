/**
 * Settings catalog list projection — AP15 P3.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRISMA_SETTINGS = path.join(
  REPO_ROOT,
  "src/settings/prisma-settings-resources.repository.ts"
);

describe("settings-catalog-list-projection.spec.ts", () => {
  it("SET-CAT-01 listEquipment uses select and take cap", () => {
    const source = fs.readFileSync(PRISMA_SETTINGS, "utf8");
    const body = source.match(/async listEquipment\([\s\S]*?\n  \}/)?.[0];
    assert.ok(body !== undefined);
    assert.match(body, /select:\s*EQUIPMENT_LIST_SELECT/);
    assert.match(body, /take:\s*MAX_SETTINGS_CATALOG/);
  });

  it("SET-CAT-02 all seven catalog list methods use MAX_SETTINGS_CATALOG", () => {
    const source = fs.readFileSync(PRISMA_SETTINGS, "utf8");
    for (const method of [
      "listTourThemes",
      "listGuideLanguages",
      "listTourPresets",
      "listRegions",
      "listDestinations",
    ]) {
      const body = source.match(new RegExp(`async ${method}\\([\\s\\S]*?\\n  \\}`))?.[0];
      assert.ok(body !== undefined, method);
      assert.match(body, /take:\s*MAX_SETTINGS_CATALOG/, method);
    }
    const equipmentCount = source.match(/take:\s*MAX_SETTINGS_CATALOG/g)?.length ?? 0;
    assert.ok(equipmentCount >= 6, "expected at least six catalog list caps");
  });
});
