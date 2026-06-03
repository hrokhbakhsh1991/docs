import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { cruiseLegacyViolations } from "./lib/legacy-cruise.js";
import { listLegacyImportCruiseRoots } from "./lib/package-cruise-roots.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const MONOREPO_SCOPE = "monorepo" as const;

describe("monorepo legacy import contract", () => {
  const cruiseRoots = listLegacyImportCruiseRoots(REPO_ROOT, MONOREPO_SCOPE);

  it("has package roots to scan", () => {
    assert.ok(cruiseRoots.length > 0);
  });

  it("depcruise no-legacy-imports passes for every package root", () => {
    const violations: string[] = [];

    for (const root of cruiseRoots) {
      const errors = cruiseLegacyViolations(REPO_ROOT, root);
      for (const err of errors) {
        violations.push(
          `${root}: ${err.rule?.name ?? "no-legacy-imports"} ${err.from ?? "?"} → ${err.to ?? "legacy"}`,
        );
      }
    }

    assert.equal(
      violations.length,
      0,
      violations.length
        ? `legacy import graph violations:\n${violations.join("\n")}`
        : undefined,
    );
  });
});
