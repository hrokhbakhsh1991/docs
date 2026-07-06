/**
 * MKT-4 / MKT-10 — platform infra shells (mother + maintenance) contract
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const marketingRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(marketingRoot, "../..");

function readMarketing(relativePath: string): string {
  return readFileSync(join(marketingRoot, relativePath), "utf8");
}

const PLATFORM_INFRA_FILES = [
  "src/platform/platform-mother-shell.tsx",
  "src/platform/maintenance-page.tsx",
  "app/page.tsx",
] as const;

const APPEARANCE_CLASSNAME_PATTERN =
  /className=\{?("|\{)[^"]*(?:bg-|text-|border-|shadow-|backdrop-|rounded-|font-|px-|py-|gap-|max-w|mx-auto|space-y|min-h-|inline-flex|underline)/;

describe("platform-infra-shell.spec.ts — MKT-4", () => {
  it("MKT-PLAT-01b globals are import-only (platform infra via marketing-bootstrap)", () => {
    const globals = readMarketing("app/globals.css");
    assert.match(globals, /@import "@app-tour\/design-tokens\/marketing-bootstrap\.css"/);
    assert.doesNotMatch(globals, /platform-infra-shell/);
    const marketingBootstrap = readFileSync(
      join(repoRoot, "packages/design-tokens/src/marketing-bootstrap.css"),
      "utf8"
    );
    assert.match(marketingBootstrap, /@import "\.\/platform-infra-shell\.css"/);
  });

  it("MKT-PLAT-02 shadow CSS targets platform data hooks", () => {
    const css = readFileSync(
      join(repoRoot, "packages/design-tokens/src/platform-infra-shell.css"),
      "utf8"
    );
    assert.match(css, /\[data-platform-mother-shell\]/);
    assert.match(css, /\[data-platform-mother-header\]/);
    assert.match(css, /main\[data-platform-mother-home\]/);
    assert.match(css, /main\[data-platform-maintenance\]/);
    assert.match(css, /a\[data-platform-admin-cta\]/);
  });

  it("MKT-PLAT-03 platform infra TSX has no appearance className", () => {
    for (const file of PLATFORM_INFRA_FILES) {
      const source = readMarketing(file);
      const motherBlock = source.includes("isPlatformMotherHost")
        ? source.slice(source.indexOf("isPlatformMotherHost"))
        : source;
      const target = file === "app/page.tsx" ? motherBlock : source;
      assert.doesNotMatch(
        target,
        APPEARANCE_CLASSNAME_PATTERN,
        `${file} must not contain appearance Tailwind className in platform infra path`
      );
    }
  });

  it("MKT-PLAT-04 mother shell exposes data-slot landmarks", () => {
    const shell = readMarketing("src/platform/platform-mother-shell.tsx");
    assert.match(shell, /data-slot="shell"/);
    assert.match(shell, /data-slot="shell-header"/);
    assert.match(shell, /data-slot="shell-main"/);
  });

  it("MKT-PLAT-05 platform infra layouts set marketing body surface attrs", () => {
    const layout = readMarketing("app/layout.tsx");
    assert.match(layout, /isPlatformMotherHost\(host\)[\s\S]*data-app-surface="marketing"/);
    assert.match(layout, /data-workspace-plugin="platform"/);
    assert.match(
      layout,
      /data-marketing-surface-maintenance[\s\S]*data-app-surface="marketing"/
    );
  });
});
