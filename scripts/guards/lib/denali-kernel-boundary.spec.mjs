import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inspectPackageJson, inspectSource } from "./denali-kernel-boundary.mjs";

describe("Phase-4 Denali kernel boundary", () => {
  it("allows hostname examples and compatibility literals", () => {
    const source = `// portal.denali.club
      const host = "portal.denali.localhost:3003";
      canonicalize(host, "denali.localhost");`;
    assert.deepEqual(inspectSource("packages/tenant-kernel/src/host.ts", source), []);
  });

  it("rejects module coupling", () => {
    for (const source of [
      `import "@app-tour/workspace-denali/register";`,
      `import { plugin } from "@app-tour/workspace-denali";`,
      `export { plugin } from "../../workspaces/denali/src/plugin";`,
      `const plugin = await import("@app-tour/workspace-denali/plugin");`,
      `const plugin = require("packages/workspaces/denali");`,
    ]) {
      assert.equal(inspectSource("packages/tenant-kernel/src/bad.ts", source)[0]?.kind, "workspace-denali-import");
    }
  });

  it("rejects product symbols and exact product ids", () => {
    const kinds = inspectSource("packages/tenant-kernel/src/bad.ts", `const denaliPlugin = resolvePlugin(workspaceType === "denali");`).map(({ kind }) => kind);
    assert.deepEqual(kinds, ["denali-product-symbol", "denali-product-id"]);
  });

  it("rejects workspace-denali package dependencies", () => {
    const source = JSON.stringify({ dependencies: { "@app-tour/workspace-denali": "workspace:*" } });
    assert.equal(inspectPackageJson("packages/tenant-kernel/package.json", source)[0]?.kind, "workspace-denali-dependency");
  });
});
