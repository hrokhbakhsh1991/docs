/**
 * Phase E3 — all workspace DTCG slices match committed tokens.css
 * @see docs/dev/dtcg-pipeline-spec.mdoc
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { generateWorkspaceTokensCss } from "../scripts/generate-workspace-dtcg-css.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(packageRoot, "..", "..");
const workspacesDtcgDir = join(packageRoot, "dtcg/workspaces");

function isWorkspaceBrandSlice(fileName) {
  return /^[^.]+\.tokens\.json$/.test(fileName);
}

describe("dtcg-e3-workspace-slices.spec.mjs", () => {
  const slices = readdirSync(workspacesDtcgDir)
    .filter((name) => name.endsWith(".tokens.json") && isWorkspaceBrandSlice(name))
    .sort();

  it("E3-01 workspace brand slices include workspaceId and ws.color-accent", () => {
    assert.deepEqual(slices, [
      "denali.tokens.json",
      "guest-club.tokens.json",
      "starter.tokens.json",
      "urban.tokens.json",
    ]);
    for (const fileName of slices) {
      const slice = JSON.parse(readFileSync(join(workspacesDtcgDir, fileName), "utf8"));
      assert.ok(typeof slice.workspaceId === "string" && slice.workspaceId.length > 0);
      assert.ok(slice.ws?.["color-accent"]?.$value);
    }
  });

  for (const fileName of ["guest-club.tokens.json", "urban.tokens.json", "denali.tokens.json"]) {
    const workspaceId = fileName.replace(/\.tokens\.json$/, "");
    it(`E3-02 ${workspaceId} theme/tokens.css is @generated from DTCG`, () => {
      const slice = JSON.parse(readFileSync(join(workspacesDtcgDir, fileName), "utf8"));
      const expected = `${generateWorkspaceTokensCss(slice, `dtcg/workspaces/${fileName}`, fileName, workspaceId)}\n`;
      const tokens = readFileSync(
        join(repoRoot, "packages/workspaces", workspaceId, "theme/tokens.css"),
        "utf8",
      );
      assert.match(tokens, /@generated/);
      assert.equal(tokens, expected);
    });
  }

  it("E3-03 guest-club accent is scaffold hex in generated output only", () => {
    const slice = JSON.parse(
      readFileSync(join(workspacesDtcgDir, "guest-club.tokens.json"), "utf8"),
    );
    const css = generateWorkspaceTokensCss(
      slice,
      "dtcg/workspaces/guest-club.tokens.json",
      "guest-club.tokens.json",
      "guest-club",
    );
    assert.match(css, /--ws-color-accent:\s*#2563eb;/);
  });
});
