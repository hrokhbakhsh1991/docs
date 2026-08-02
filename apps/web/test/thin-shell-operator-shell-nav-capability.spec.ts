/**
 * Thin Shell Phase 4bc — operatorShellNav capability + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getUrbanPlugin } from "@app-tour/workspace-urban";
import { resolveOperatorShellNavCapability } from "@app-tour/workspace-sdk";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-operator-shell-nav-capability — Phase 4bc", () => {
  it("TS-4BC-01 urban publishes capabilities.operatorShellNav links", () => {
    const plugin = getUrbanPlugin();
    const nav = resolveOperatorShellNavCapability(plugin);
    assert.ok(nav);
    assert.equal(nav.links.length, 2);
    assert.equal(nav.links[0]?.href, "/catalog");
  });

  it("TS-4BC-02 operator-shell-nav binder deleted; registry is capability-only", () => {
    const binder = resolve(WEB_ROOT, "src/bootstrap/operator-shell-nav-bindings.generated.ts");
    assert.equal(existsSync(binder), false);

    const registry = readFileSync(
      resolve(WEB_ROOT, "src/shell/operator-shell-nav-registry.ts"),
      "utf8"
    );
    const shell = readFileSync(resolve(WEB_ROOT, "src/shell/app-shell.tsx"), "utf8");

    assert.match(registry, /resolveOperatorShellNavCapability/);
    assert.match(registry, /app-cloud\.operatorShellNavCache/);
    assert.doesNotMatch(registry, /operator-shell-nav-bindings/);
    assert.match(shell, /operator-shell-nav-registry/);
    assert.doesNotMatch(shell, /operator-shell-nav-bindings/);
  });
});
