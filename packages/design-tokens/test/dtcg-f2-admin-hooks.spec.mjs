/**
 * Phase F2 — finance + wizard shell hooks hex-free (admin semantic vars)
 * @see docs/dev/dtcg-pipeline-spec.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(packageRoot, "..", "..");
const denaliThemeDir = join(repoRoot, "packages/workspaces/denali/theme");

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

const F2_HOOKS = ["finance-skin.css", "wizard-skin.css", "wizard-calendar.css"];

function readHook(fileName) {
  return readFileSync(join(denaliThemeDir, fileName), "utf8");
}

describe("dtcg-f2-admin-hooks.spec.mjs", () => {
  for (const fileName of F2_HOOKS) {
    it(`F2-01 ${fileName} contains no raw # hex`, () => {
      const css = readHook(fileName);
      assert.equal(css.match(HEX_RE), null, fileName);
    });
  }

  it("F2-02 wizard-calendar aliases admin semantic primary vars", () => {
    const calendar = readHook("wizard-calendar.css");
    // Wave H.q: --denali-wizard-calendar-primary* → --operator-wizard-calendar-primary*
    // @see docs/dev/wave-h-operator-wizard-calendar-bem.mdoc
    assert.match(calendar, /--operator-wizard-calendar-primary:\s*var\(--color-primary\)/);
    assert.match(calendar, /--operator-wizard-calendar-primary-fg:\s*var\(--color-primary-fg\)/);
    assert.match(calendar, /--operator-wizard-calendar-primary-hover:\s*var\(--color-primary-hover\)/);
    assert.doesNotMatch(calendar, /--denali-wizard-calendar-primary/);
    assert.doesNotMatch(calendar, /html\.dark:has\([\s\S]*--operator-wizard-calendar-primary:/);
  });

  it("F2-03 wizard skin dark re-bind uses inherited semantic vars", () => {
    const skin = readHook("wizard-skin.css");
    assert.match(
      skin,
      /html\.dark:has\(body\[data-workspace-plugin="denali"\]\) \[data-new-tour-wizard\][\s\S]*--color-primary:\s*var\(--color-primary\)/,
    );
  });

  it("F2-04 finance date-picker selected day uses semantic fg", () => {
    const finance = readHook("finance-skin.css");
    assert.match(finance, /color:\s*var\(--color-primary-fg\)/);
  });
});
