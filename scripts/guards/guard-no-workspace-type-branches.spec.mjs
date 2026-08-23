import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  hasPluginIdBranch,
  hasPluginIdFallback,
  hasWorkspaceTypeBranch,
  hasWorkspaceTypeFallback,
} from "./guard-no-workspace-type-branches.mjs";

describe("guard-no-workspace-type-branches matchers", () => {
  it("rejects arbitrary workspaceType product-id comparisons", () => {
    assert.equal(hasWorkspaceTypeBranch(`if (workspaceType === "denali") return;`), true);
    assert.equal(hasWorkspaceTypeBranch(`if ("alpine" !== workspaceType) return;`), true);
    assert.equal(hasWorkspaceTypeBranch(`if (workspaceType == "harbor") return;`), true);
  });

  it("rejects arbitrary pluginId product-id comparisons", () => {
    assert.equal(hasPluginIdBranch(`if (pluginId === "denali") return;`), true);
    assert.equal(hasPluginIdBranch(`if ("alpine" !== pluginId) return;`), true);
  });

  it("allows registry lookup and non-branch workspace values", () => {
    assert.equal(hasWorkspaceTypeBranch(`return registry[workspaceType];`), false);
    assert.equal(
      hasWorkspaceTypeBranch(`const workspaceType = await resolveWorkspaceType();`),
      false
    );
    assert.equal(hasPluginIdBranch(`return loadPlugin(pluginId);`), false);
  });

  it("rejects product workspaceType fallbacks", () => {
    assert.equal(hasWorkspaceTypeFallback(`const id = workspaceType ?? "starter";`), true);
    assert.equal(hasWorkspaceTypeFallback(`const id = workspaceType ?? "alpine";`), true);
    assert.equal(hasWorkspaceTypeFallback(`const id = workspaceType || "denali";`), true);
    assert.equal(
      hasWorkspaceTypeFallback(`const workspaceType = isOwner ? ownerType : "urban";`),
      true
    );
    assert.equal(
      hasWorkspaceTypeFallback(`const workspaceType = isOwner ? ownerType : "harbor";`),
      true
    );
  });

  it("rejects product pluginId fallbacks", () => {
    assert.equal(hasPluginIdFallback(`const id = pluginId ?? "starter";`), true);
    assert.equal(hasPluginIdFallback(`const id = pluginId ?? "alpine";`), true);
    assert.equal(hasPluginIdFallback(`const id = pluginId || "denali";`), true);
    assert.equal(hasPluginIdFallback(`const pluginId = known ? resolved : "urban";`), true);
    assert.equal(hasPluginIdFallback(`const pluginId = known ? resolved : "harbor";`), true);
  });

  it("allows registry lookups and explicit non-product fallback values", () => {
    assert.equal(hasWorkspaceTypeFallback(`return registry[workspaceType];`), false);
    assert.equal(hasWorkspaceTypeFallback(`const id = workspaceType ?? "unknown";`), false);
    assert.equal(hasPluginIdFallback(`return loadPlugin(pluginId);`), false);
    assert.equal(hasPluginIdFallback(`const id = pluginId ?? "unknown";`), false);
  });

  it("keeps the central tenant workspace resolver inside the API scan", () => {
    const guard = readFileSync(
      join(import.meta.dirname, "guard-no-workspace-type-branches.mjs"),
      "utf8"
    );
    assert.doesNotMatch(guard, /apps\/api\/src\/tenant\/resolve-workspace-type\.ts/);
  });
});
