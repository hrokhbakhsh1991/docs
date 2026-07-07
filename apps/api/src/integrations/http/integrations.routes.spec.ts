import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildIntegrationSecretRef,
  InMemoryIntegrationSecretStore,
  installIntegrationSecretStoreForTests,
  maskSecretRef,
  resetIntegrationSecretStoreForTests,
} from "../infrastructure/integration-secret-store";

describe("integrations control plane secrets", () => {
  it("maskSecretRef never exposes full ref", () => {
    const masked = maskSecretRef("integration-connection:01234567-89ab-cdef");
    assert.ok(masked !== null);
    assert.equal(masked?.includes("botToken"), false);
    assert.ok(masked!.includes("…"));
  });

  it("secret store round-trips without exposing via DTO helpers", async () => {
    resetIntegrationSecretStoreForTests();
    const store = new InMemoryIntegrationSecretStore();
    installIntegrationSecretStoreForTests(store);
    const ref = buildIntegrationSecretRef("conn-1");
    await store.put("tenant-a", ref, { botToken: "super-secret" });
    const loaded = await store.get("tenant-a", ref);
    assert.equal(loaded?.botToken, "super-secret");
    assert.notEqual(maskSecretRef(ref), ref);
  });
});
