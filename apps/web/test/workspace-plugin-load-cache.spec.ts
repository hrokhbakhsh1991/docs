import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import {
  getOrCreateWorkspacePluginLoad,
  getWorkspacePluginLoadCacheStats,
  invalidateWorkspacePluginLoadCache,
} from "../src/bootstrap/workspace-plugin-load-cache";

function fakePlugin(id: string): WorkspacePlugin {
  return {
    id,
    wizard: { roots: [], steps: {} },
  } as WorkspacePlugin;
}

describe("workspace plugin load cache (Phase I2)", () => {
  it("single-flights concurrent loads for the same pluginId", async () => {
    invalidateWorkspacePluginLoadCache();
    let loads = 0;
    const options = { registryRevision: "a,b", maxEntries: 2 };
    const load = () => {
      loads += 1;
      return Promise.resolve(fakePlugin("a"));
    };

    const [p1, p2] = await Promise.all([
      getOrCreateWorkspacePluginLoad("a", load, options),
      getOrCreateWorkspacePluginLoad("a", load, options),
    ]);

    assert.equal(loads, 1);
    assert.equal(p1.id, "a");
    assert.equal(p2.id, "a");
    assert.equal(getWorkspacePluginLoadCacheStats().size, 1);
  });

  it("busts cache when registry revision changes", async () => {
    invalidateWorkspacePluginLoadCache();
    let loads = 0;
    const load = () => {
      loads += 1;
      return Promise.resolve(fakePlugin("a"));
    };

    await getOrCreateWorkspacePluginLoad("a", load, { registryRevision: "v1", maxEntries: 2 });
    await getOrCreateWorkspacePluginLoad("a", load, { registryRevision: "v2", maxEntries: 2 });
    assert.equal(loads, 2);
  });

  it("rejects cache growth beyond maxEntries", async () => {
    invalidateWorkspacePluginLoadCache();
    const options = { registryRevision: "x,y", maxEntries: 1 };
    await getOrCreateWorkspacePluginLoad("x", () => Promise.resolve(fakePlugin("x")), options);
    assert.throws(
      () => getOrCreateWorkspacePluginLoad("y", () => Promise.resolve(fakePlugin("y")), options),
      /WORKSPACE_PLUGIN_LOAD_CACHE_FULL/
    );
  });

  it("evicts rejected loads so an explicit retry can import again", async () => {
    invalidateWorkspacePluginLoadCache();
    let loads = 0;
    const options = { registryRevision: "retry", maxEntries: 1 };
    const load = async () => {
      loads += 1;
      if (loads === 1) throw new Error("chunk unavailable");
      return fakePlugin("a");
    };

    await assert.rejects(getOrCreateWorkspacePluginLoad("a", load, options));
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const plugin = await getOrCreateWorkspacePluginLoad("a", load, options);
    assert.equal(plugin.id, "a");
    assert.equal(loads, 2);
  });

  it("invalidateWorkspacePluginLoadCache clears entries", async () => {
    await getOrCreateWorkspacePluginLoad("a", () => Promise.resolve(fakePlugin("a")), {
      registryRevision: "a",
      maxEntries: 1,
    });
    assert.equal(getWorkspacePluginLoadCacheStats().size, 1);
    invalidateWorkspacePluginLoadCache();
    assert.equal(getWorkspacePluginLoadCacheStats().size, 0);
  });
});
