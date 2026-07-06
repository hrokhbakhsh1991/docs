/**
 * Phase F6 — operator-admin appearance decomposition
 * @see docs/dev/dtcg-pipeline-spec.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  generateAdminDarkSemanticsCss,
  generateDarkThemeCss,
} from "../scripts/generate-dtcg-theme.mjs";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const darkDtcgPath = join(packageRoot, "dtcg/platform.dark.tokens.json");

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

describe("dtcg-f6-admin-appearance.spec.mjs", () => {
  it("F6-01 admin dark semantics generated from platform.dark.tokens.json", () => {
    const dtcg = JSON.parse(readFileSync(darkDtcgPath, "utf8"));
    const expected = `${generateAdminDarkSemanticsCss(dtcg)}\n`;
    const css = readFileSync(join(packageRoot, "src/operator-admin-dark-semantics.css"), "utf8");
    assert.match(css, /@generated/);
    assert.equal(css, expected);
  });

  it("F6-02 admin dark uses .dark cascade; guest dark uses .theme-dark only", () => {
    const dtcg = JSON.parse(readFileSync(darkDtcgPath, "utf8"));
    const adminDark = generateAdminDarkSemanticsCss(dtcg);
    const guestDark = generateDarkThemeCss(dtcg);
    assert.match(adminDark, /\.dark,\n\.dark \.theme-light,\n\.theme-dark/);
    assert.match(guestDark, /^[\s\S]*\.theme-dark\s*\{/m);
    assert.doesNotMatch(guestDark, /^\.dark,/m);
  });

  it("F6-03 operator-admin-appearance is hook-only", () => {
    const appearance = readFileSync(
      join(packageRoot, "src/operator-admin-appearance.css"),
      "utf8",
    );
    assert.match(appearance, /@import "\.\/operator-admin-dark-semantics\.css"/);
    assert.match(appearance, /@import "\.\/guest-body-reset\.css"/);
    assert.equal(appearance.match(HEX_RE), null);
    assert.match(appearance, /\.workspace-wizard-shell\s*\{/);
    assert.match(appearance, /var\(--color-danger\)/);
  });

  it("F6-04 admin-bootstrap still imports operator-admin-appearance", () => {
    const bootstrap = readFileSync(join(packageRoot, "src/admin-bootstrap.css"), "utf8");
    assert.match(bootstrap, /operator-admin-appearance\.css/);
  });
});
