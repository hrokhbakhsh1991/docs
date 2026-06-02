import assert from "node:assert/strict";
import { test } from "node:test";

test("membership metadata patch rejects unsafe remove keys at runtime", async () => {
  const { applyMembershipMetadataJsonbPatch } = await import("./membership-metadata-jsonb");
  const manager = {
    query: async () => {
      throw new Error("should not run");
    }
  };
  await assert.rejects(
    () =>
      applyMembershipMetadataJsonbPatch(manager as never, {
        membershipId: "11111111-1111-4111-8111-111111111111",
        tenantId: "22222222-2222-4222-8222-222222222222",
        removeKeys: ["badges;drop table"]
      }),
    /Unsafe membership_metadata key/
  );
});
