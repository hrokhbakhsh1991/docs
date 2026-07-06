/**
 * Phase F1 — admin semantic DTCG + admin-skin hook hex ban
 * @see docs/dev/dtcg-pipeline-spec.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  generateWorkspaceTokensCss,
  resolveDtcgReferenceValue,
  resolveWorkspaceSliceOutputRelativePath,
} from "../scripts/generate-workspace-dtcg-css.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(packageRoot, "..", "..");
const workspacesDtcgDir = join(packageRoot, "dtcg/workspaces");

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const ADMIN_SLICE = "denali.admin.tokens.json";

function readWorkspaceFile(workspaceId, relativePath) {
  return readFileSync(join(repoRoot, "packages/workspaces", workspaceId, relativePath), "utf8");
}

describe("dtcg-f1-admin-skin.spec.mjs", () => {
  it("F1-01 denali.admin.tokens.json exists and maps to admin-semantic-tokens.css", () => {
    const outputRelativePath = resolveWorkspaceSliceOutputRelativePath(ADMIN_SLICE, "denali");
    assert.equal(outputRelativePath, "theme/admin-semantic-tokens.css");
  });

  it("F1-02 admin semantic CSS matches generator output", () => {
    const slice = JSON.parse(readFileSync(join(workspacesDtcgDir, ADMIN_SLICE), "utf8"));
    const expected = `${generateWorkspaceTokensCss(slice, `dtcg/workspaces/${ADMIN_SLICE}`, ADMIN_SLICE, "denali")}\n`;
    const css = readWorkspaceFile("denali", "theme/admin-semantic-tokens.css");
    assert.match(css, /@generated/);
    assert.equal(css, expected);
  });

  it("F1-03 admin semantic CSS defines light + dark scopes", () => {
    const css = readWorkspaceFile("denali", "theme/admin-semantic-tokens.css");
    assert.match(css, /body\[data-workspace-plugin="denali"\]/);
    assert.match(css, /html\.dark:has\(body\[data-workspace-plugin="denali"\]\)/);
    assert.match(css, /--color-primary:\s*#5eead4/);
    assert.match(css, /--ring:\s*var\(--focus-ring-color\)/);
  });

  it("F1-04 flat.* DTCG references resolve to unprefixed CSS vars", () => {
    assert.equal(resolveDtcgReferenceValue("{flat.focus-ring-color}"), "var(--focus-ring-color)");
    assert.equal(resolveDtcgReferenceValue("{color.primary}"), "var(--color-primary)");
  });

  it("F1-05 admin-skin.css is hook-only (no raw # hex)", () => {
    const skin = readWorkspaceFile("denali", "theme/admin-skin.css");
    assert.match(skin, /@import "\.\/admin-semantic-tokens\.css"/);
    assert.equal(skin.match(HEX_RE), null);
  });
});
