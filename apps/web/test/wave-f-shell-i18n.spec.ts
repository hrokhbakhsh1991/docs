/**
 * Wave F.a — platform i18n must not import Denali host adapters.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const WEB_ROOT = join(import.meta.dirname, "..");
const I18N_DIR = join(WEB_ROOT, "src/i18n");

function listTsFiles(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      files.push(...listTsFiles(abs));
      continue;
    }
    if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      files.push(abs);
    }
  }
  return files;
}

describe("wave-f-shell-i18n.spec.ts — Wave F.a", () => {
  it("F.a-01 apps/web/src/i18n has zero legacy-scope or package denali imports", () => {
    // Construct legacy scope without embedding the forbidden substring in this file (Wave H.k).
    const legacyDenaliImport = new RegExp(`${["@", "app-cloud"].join("")}\\/workspace-denali`);
    assert.equal(existsSync(join(I18N_DIR, "wizard-labels.ts")), false);
    for (const abs of listTsFiles(I18N_DIR)) {
      const source = readFileSync(abs, "utf8");
      assert.doesNotMatch(
        source,
        legacyDenaliImport,
        `forbidden legacy-scope denali import in ${abs.slice(WEB_ROOT.length + 1)}`
      );
      assert.doesNotMatch(
        source,
        /@app-tour\/workspace-denali/,
        `forbidden denali package import in ${abs.slice(WEB_ROOT.length + 1)}`
      );
    }
  });

  it("F.a-02 format-canonical-path-label is local platform util (no denali import)", () => {
    const source = readFileSync(join(I18N_DIR, "format-canonical-path-label.ts"), "utf8");
    assert.match(source, /export function formatCanonicalPathToLabel/);
    assert.doesNotMatch(source, /workspace-denali/);
  });

  it("F.a-03 Denali label barrel is absent from wizard/denali (Wave F.d)", () => {
    assert.equal(existsSync(join(WEB_ROOT, "src/wizard/denali/wizard-labels.ts")), false);
  });
});
