import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("settings-hub-server-prefetch.spec.ts", () => {
  it("HUB-01 settings page prefetches modules on the server", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/(app)/settings/page.tsx"), "utf8");
    assert.match(pageSource, /fetchSettingsModulesServer/);
    assert.match(pageSource, /initialModules/);
  });

  it("HUB-02 hub client skips client fetch when initialModules is provided", () => {
    const clientSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/settings-hub-client.tsx"),
      "utf8"
    );
    assert.match(clientSource, /initialModules/);
    assert.match(clientSource, /initialModules === null/);
    assert.match(clientSource, /if \(initialModules !== null\)/);
  });
});
