import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKIN_PATH = join(PACKAGE_ROOT, "theme", "starter-portal.css");

describe("starter-portal-skin.spec.ts", () => {
  const portalCss = readFileSync(SKIN_PATH, "utf8");

  it("D2-01 targets portal shell chrome and member profile modules", () => {
    assert.match(portalCss, /body\[data-app-surface="portal"\]/);
    assert.match(portalCss, /\[data-portal-shell-nav-link\]\[data-active="true"\]/);
    assert.match(portalCss, /main\[data-portal-member-profile\]/);
  });

  it("D2-02 package exports starter-portal.css", () => {
    const pkg = readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8");
    assert.match(pkg, /"\.\/theme\/starter-portal\.css"/);
  });
});

describe("starter-marketing-skin.spec.ts", () => {
  const marketingCss = readFileSync(join(PACKAGE_ROOT, "theme", "starter-marketing.css"), "utf8");

  it("D3-01 targets marketing shell chrome hooks", () => {
    assert.match(marketingCss, /body\[data-app-surface="marketing"\]/);
    assert.match(marketingCss, /header\[data-marketing-header\]/);
    assert.match(marketingCss, /footer\[data-marketing-footer\]/);
  });

  it("D3-02 package exports starter-marketing.css", () => {
    const pkg = readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8");
    assert.match(pkg, /"\.\/theme\/starter-marketing\.css"/);
  });
});
