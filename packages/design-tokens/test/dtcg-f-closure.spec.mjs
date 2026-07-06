/**
 * Phase F closure — cross-cutting contracts after F1–F6
 * @see docs/dev/dtcg-pipeline-spec.mdoc § Phase F closure
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const designTokensSrc = join(repoRoot, "packages/design-tokens/src");
const denaliThemeDir = join(repoRoot, "packages/workspaces/denali/theme");

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;
const IMPORT_RE = /@import\s+"\.\/([^"]+)"/g;

/**
 * @param {string} cssPath
 * @param {Set<string>} [seen]
 * @returns {string[]}
 */
function collectRelativeImports(cssPath, seen = new Set()) {
  const normalized = cssPath;
  if (seen.has(normalized)) {
    return [];
  }
  seen.add(normalized);

  const content = readFileSync(normalized, "utf8");
  const dir = dirname(normalized);
  /** @type {string[]} */
  const imports = [];

  for (const match of content.matchAll(IMPORT_RE)) {
    const target = join(dir, match[1]);
    imports.push(target);
    imports.push(...collectRelativeImports(target, seen));
  }

  return imports;
}

describe("dtcg-f-closure.spec.mjs", () => {
  it("F-CL-01 operator-shell-structure is hex-free; impersonation banner uses semantic warning", () => {
    const structure = readFileSync(join(designTokensSrc, "operator-shell-structure.css"), "utf8");
    assert.equal(structure.match(HEX_RE), null);
    assert.match(structure, /\[data-operator-impersonation-banner\][\s\S]*var\(--color-warning\)/);
  });

  it("F-CL-02 operator-admin-appearance has no guest cross-surface import", () => {
    const appearance = readFileSync(join(designTokensSrc, "operator-admin-appearance.css"), "utf8");
    assert.doesNotMatch(appearance, /guest-body-reset\.css/);
    assert.match(appearance, /body\s*\{/);
    assert.equal(appearance.match(HEX_RE), null);
  });

  it("F-CL-03 denali-admin.css @import chain resolves on disk", () => {
    const entry = join(denaliThemeDir, "denali-admin.css");
    const imports = collectRelativeImports(entry);
    assert.ok(imports.length > 0, "expected denali-admin.css to import theme partials");
    for (const importPath of imports) {
      assert.ok(existsSync(importPath), `missing ${relative(repoRoot, importPath)}`);
    }
    assert.ok(
      imports.some((p) => p.endsWith("admin-semantic-tokens.css")),
      "admin semantic layer must be reachable from bundle",
    );
    assert.ok(
      imports.some((p) => p.endsWith("wizard-semantic-tokens.css")),
      "wizard semantic layer must be reachable from bundle",
    );
  });

  it("F-CL-04 workspace-denali package publishes full theme directory", () => {
    const pkg = JSON.parse(
      readFileSync(join(repoRoot, "packages/workspaces/denali/package.json"), "utf8"),
    );
    assert.ok(pkg.files.includes("theme"), 'files must include "theme" for npm pack @import chains');
  });
});
