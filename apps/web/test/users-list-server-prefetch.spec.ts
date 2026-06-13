import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("users-list-server-prefetch.spec.ts", () => {
  it("USERS-01 users page prefetches list on the server", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/(app)/users/page.tsx"), "utf8");
    assert.match(pageSource, /fetchUsersListServer/);
    assert.match(pageSource, /initialUsersList/);
    assert.match(pageSource, /initialOwnershipRoster/);
  });

  it("USERS-02 users client skips first fetch when initialUsersList is provided", () => {
    const clientSource = readFileSync(resolve(WEB_ROOT, "app/(app)/users/users-page-client.tsx"), "utf8");
    assert.match(clientSource, /initialUsersList/);
    assert.match(clientSource, /skipInitialFetchRef/);
  });

  it("USERS-03 ownership transfer panel accepts initialRoster", () => {
    const panelSource = readFileSync(
      resolve(WEB_ROOT, "app/(app)/users/users-ownership-transfer-panel.tsx"),
      "utf8"
    );
    assert.match(panelSource, /initialRoster/);
    assert.match(panelSource, /skipInitialFetchRef/);
  });
});
