/**
 * Phase F3 — wizard fields tone palette DTCG + wizard-fields hook hex ban
 * @see docs/dev/dtcg-pipeline-spec.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  generateWorkspaceTokensCss,
  resolveWorkspaceSliceOutputRelativePath,
} from "../scripts/generate-workspace-dtcg-css.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(packageRoot, "..", "..");
const workspacesDtcgDir = join(packageRoot, "dtcg/workspaces");

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const WIZARD_SLICE = "denali.wizard.tokens.json";

function readWorkspaceFile(workspaceId, relativePath) {
  return readFileSync(join(repoRoot, "packages/workspaces", workspaceId, relativePath), "utf8");
}

describe("dtcg-f3-wizard-fields.spec.mjs", () => {
  it("F3-01 denali.wizard.tokens.json maps to wizard-semantic-tokens.css", () => {
    const outputRelativePath = resolveWorkspaceSliceOutputRelativePath(WIZARD_SLICE, "denali");
    assert.equal(outputRelativePath, "theme/wizard-semantic-tokens.css");
  });

  it("F3-02 wizard semantic CSS matches generator output", () => {
    const slice = JSON.parse(readFileSync(join(workspacesDtcgDir, WIZARD_SLICE), "utf8"));
    const expected = `${generateWorkspaceTokensCss(slice, `dtcg/workspaces/${WIZARD_SLICE}`, WIZARD_SLICE, "denali")}\n`;
    const css = readWorkspaceFile("denali", "theme/wizard-semantic-tokens.css");
    assert.match(css, /@generated/);
    assert.equal(css, expected);
  });

  it("F3-03 wizard semantic CSS defines tone palette vars", () => {
    const css = readWorkspaceFile("denali", "theme/wizard-semantic-tokens.css");
    assert.match(css, /--wiz-tone-forest-source:\s*#059669/);
    assert.match(css, /--wiz-tone-sky-fg-gear:\s*#0c4a6e/);
    assert.match(css, /--color-danger:\s*#dc2626/);
  });

  it("F3-04 wizard-fields.css imports semantic layer and has no raw # hex", () => {
    const fields = readWorkspaceFile("denali", "theme/wizard-fields.css");
    assert.match(fields, /@import "\.\/wizard-semantic-tokens\.css"/);
    assert.equal(fields.match(HEX_RE), null);
    assert.match(fields, /var\(--wiz-tone-forest-source\)/);
    assert.match(fields, /var\(--wiz-tone-forest-dark-source\)/);
  });
});
