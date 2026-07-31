import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { getStarterWorkspacePlugin } from "../src/starter.plugin";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("DG-2.1 starter catalog neutrality", () => {
  it("owns basics.title in field registry without Denali alias", () => {
    const plugin = getStarterWorkspacePlugin();
    const paths = new Set(plugin.fieldRegistry.fields.map((field) => field.canonicalPath));
    assert.equal(paths.has("basics.title"), true);
    assert.equal(paths.has("title"), false);
  });

  it("manifest does not alias wizardTemplate paths to denali", () => {
    const manifest = JSON.parse(
      readFileSync(join(packageRoot, "workspace.manifest.json"), "utf8"),
    ) as {
      readonly wizardTemplate?: {
        readonly aliasCatalogWorkspaceType?: string;
        readonly pathAliases?: readonly string[];
      };
    };
    assert.equal(manifest.wizardTemplate, undefined);
  });
});
