import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertPlatformOpsAuth } from "../src/platform/assert-platform-ops-auth.ts";

describe("platform auth db role", () => {
  it("support from DB", async () => {
    const repository = {
      async findByPhone(phone: string) {
        if (phone === "+10000000099") {
          return { phone, role: "support", createdAt: new Date() };
        }
        return null;
      },
      async listAll() {
        return [];
      },
      async upsert() {
        throw new Error("not used");
      },
    };

    const ctx = await assertPlatformOpsAuth(
      {
        Authorization: "Bearer platform-ops",
        "X-Platform-Ops-Phone": "+10000000099",
      },
      { repository }
    );
    assert.deepEqual(ctx.roles, ["support"]);
    assert.equal(ctx.actorId, "+10000000099");
  });
});
