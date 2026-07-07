/**
 * Phase F9-2 — Denali admin dark primary isolation from platform blue
 * @see docs/dev/dtcg-pipeline-spec.mdoc § F9
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(packageRoot, "..", "..");
const workspacesDtcgDir = join(packageRoot, "dtcg/workspaces");

const DENALI_DARK_PRIMARY = "#5eead4";
const PLATFORM_DARK_PRIMARY = "#5b9fd4";
const ADMIN_SLICE = "denali.admin.tokens.json";

function readWorkspaceFile(workspaceId, relativePath) {
  return readFileSync(join(repoRoot, "packages/workspaces", workspaceId, relativePath), "utf8");
}

describe("dtcg-f9-admin-dark-primary.spec.mjs", () => {
  it("F9-01 denali admin semantic dark primary is teal not platform blue", () => {
    const css = readWorkspaceFile("denali", "theme/admin-semantic-tokens.css");
    assert.match(css, new RegExp(`--color-primary:\\s*${DENALI_DARK_PRIMARY}`));
    assert.doesNotMatch(css, new RegExp(PLATFORM_DARK_PRIMARY));
    assert.match(css, /body\[data-workspace-plugin="denali"\] \.theme-dark/);
  });

  it("F9-02 dark block wires shadcn --primary to semantic --color-primary", () => {
    const css = readWorkspaceFile("denali", "theme/admin-semantic-tokens.css");
    const darkSection = css.slice(css.indexOf("html.dark:has(body[data-workspace-plugin=\"denali\"])"));
    assert.match(darkSection, /--primary:\s*var\(--color-primary\)/);
    assert.match(darkSection, /--primary-foreground:\s*var\(--color-primary-fg\)/);
  });

  it("F9-03 DTCG dark block color.primary is #5eead4", () => {
    const slice = JSON.parse(readFileSync(join(workspacesDtcgDir, ADMIN_SLICE), "utf8"));
    const darkBlock = slice.blocks[1];
    assert.equal(darkBlock.color.primary.$value, DENALI_DARK_PRIMARY);
  });

  it("F9-04 platform themes/dark.css keeps separate platform contract", () => {
    const platformDark = readFileSync(
      join(repoRoot, "packages/design-tokens/src/themes/dark.css"),
      "utf8",
    );
    assert.match(platformDark, new RegExp(`--color-primary:\\s*${PLATFORM_DARK_PRIMARY}`));
  });
});
