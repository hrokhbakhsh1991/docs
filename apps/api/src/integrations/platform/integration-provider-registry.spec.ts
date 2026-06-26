import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  getIntegrationProvider,
  registerIntegrationProvider,
  resetIntegrationProviderRegistryForTests,
} from "./integration-provider-registry";
import {
  bootstrapIntegrationProviders,
  resetIntegrationProviderBootstrapForTests,
} from "./bootstrap-integration-providers";
import { createTelegramProviderAdapter } from "../providers/telegram";

describe("integration-provider-registry", () => {
  beforeEach(() => {
    resetIntegrationProviderRegistryForTests();
    resetIntegrationProviderBootstrapForTests();
  });

  it("registers telegram via bootstrapIntegrationProviders", () => {
    bootstrapIntegrationProviders();
    const telegram = getIntegrationProvider("telegram");
    assert.ok(telegram !== undefined);
    assert.equal(telegram.id, "telegram");
    assert.ok(telegram.supportedCapabilities.includes("message.send"));
  });

  it("registerIntegrationProvider overwrites same provider id", () => {
    registerIntegrationProvider(createTelegramProviderAdapter());
    registerIntegrationProvider(createTelegramProviderAdapter());
    assert.equal(getIntegrationProvider("telegram")?.id, "telegram");
  });
});
