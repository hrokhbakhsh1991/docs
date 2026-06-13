import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("profile-server-prefetch.spec.ts", () => {
  it("PROFILE-01 profile page prefetches on the server", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/(app)/settings/me/page.tsx"), "utf8");
    assert.match(pageSource, /fetchOperatorProfileServer/);
    assert.match(pageSource, /initialProfile/);
  });

  it("PROFILE-02 profile client skips first fetch when initialProfile is provided", () => {
    const clientSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/settings/me/profile-settings-client.tsx"),
      "utf8"
    );
    assert.match(clientSource, /initialProfile/);
    assert.match(clientSource, /skipInitialFetchRef/);
  });
});
