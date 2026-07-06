/**
 * Phase E4 — skin semantic DTCG slices + hook hex ban
 * @see docs/dev/dtcg-pipeline-spec.mdoc
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
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

function readWorkspaceFile(workspaceId, relativePath) {
  return readFileSync(join(repoRoot, "packages/workspaces", workspaceId, relativePath), "utf8");
}

describe("dtcg-e4-skin-semantic.spec.mjs", () => {
  const skinSlices = readdirSync(workspacesDtcgDir)
    .filter((name) => /\.(marketing|portal)\.tokens\.json$/.test(name))
    .sort();

  it("E4-01 skin semantic slices exist for guest-club, urban, denali", () => {
    assert.deepEqual(skinSlices, [
      "denali.marketing.tokens.json",
      "denali.portal.tokens.json",
      "guest-club.marketing.tokens.json",
      "guest-club.portal.tokens.json",
      "urban.marketing.tokens.json",
      "urban.portal.tokens.json",
    ]);
  });

  for (const fileName of skinSlices) {
    const workspaceId = fileName.split(".")[0];
    const outputRelativePath = resolveWorkspaceSliceOutputRelativePath(fileName, workspaceId);
    it(`E4-02 ${fileName} → ${outputRelativePath}`, () => {
      const slice = JSON.parse(readFileSync(join(workspacesDtcgDir, fileName), "utf8"));
      const expected = `${generateWorkspaceTokensCss(slice, `dtcg/workspaces/${fileName}`, fileName, workspaceId)}\n`;
      const css = readWorkspaceFile(workspaceId, outputRelativePath);
      assert.match(css, /@generated/);
      assert.equal(css, expected);
    });
  }

  it("E4-03 skin hook files contain no raw # hex", () => {
    for (const workspaceId of ["denali", "urban", "guest-club"]) {
      const marketingHook = readWorkspaceFile(workspaceId, "theme/marketing/tokens.css");
      assert.equal(marketingHook.match(HEX_RE), null, `${workspaceId} marketing/tokens.css`);
    }
    assert.equal(readWorkspaceFile("denali", "theme/denali-portal.css").match(HEX_RE), null);
    assert.equal(readWorkspaceFile("urban", "theme/urban-portal.css").match(HEX_RE), null);
    assert.equal(readWorkspaceFile("guest-club", "theme/guest-club-portal.css").match(HEX_RE), null);
  });
});
