/**
 * Phase E5 — marketing shell + component hooks are hex-free; mkt tokens in DTCG
 * @see docs/dev/dtcg-pipeline-spec.mdoc
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const HEX_RE = /#[0-9a-fA-F]{3,8}\b/g;

function readMarketingHook(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

function assertNoHex(relativePath) {
  const content = readMarketingHook(relativePath);
  const matches = content.match(HEX_RE);
  assert.equal(matches, null, `${relativePath} must not contain raw # hex`);
}

describe("dtcg-e5-marketing-components.spec.mjs", () => {
  it("E5-01 denali marketing semantic-tokens includes mkt overlay palette", () => {
    const semantic = readMarketingHook(
      "packages/workspaces/denali/theme/marketing/semantic-tokens.css",
    );
    assert.match(semantic, /@generated/);
    assert.match(semantic, /--mkt-on-overlay:\s*#ffffff/);
    assert.match(semantic, /--mkt-overlay-icon:\s*#fbbf24/);
    assert.match(semantic, /--mkt-mask-ink:\s*#000000/);
  });

  it("E5-02 denali marketing shell + all component partials are hex-free", () => {
    assertNoHex("packages/workspaces/denali/theme/marketing/shell.css");
    const componentsDir = join(
      repoRoot,
      "packages/workspaces/denali/theme/marketing/components",
    );
    for (const fileName of readdirSync(componentsDir).filter((n) => n.endsWith(".css")).sort()) {
      assertNoHex(`packages/workspaces/denali/theme/marketing/components/${fileName}`);
    }
  });

  it("E5-03 guest-club marketing shell + catalog partial are hex-free", () => {
    assertNoHex("packages/workspaces/guest-club/theme/marketing/shell.css");
    assertNoHex("packages/workspaces/guest-club/theme/marketing/components/01-catalog.css");
  });

  it("E5-04 denali shell overlay uses mkt vars not literals", () => {
    const shell = readMarketingHook("packages/workspaces/denali/theme/marketing/shell.css");
    assert.match(shell, /color:\s*var\(--mkt-on-overlay\)/);
    assert.match(shell, /color:\s*var\(--mkt-overlay-icon\)/);
  });
});
