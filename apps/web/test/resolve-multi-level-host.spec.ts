import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveMultiLevelHost } from "../src/tenant/resolve-multi-level-host";

describe("resolve-multi-level-host", () => {
  it("alborz.admin.localhost parsed", () => {
    const outcome = resolveMultiLevelHost("alborz.admin.localhost:3000");
    assert.deepEqual(outcome, { kind: "club_admin", subdomain: "alborz" });
  });
});
