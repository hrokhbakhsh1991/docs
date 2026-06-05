import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";

import {
  buildValidatedCanonicalDocument,
  resetValidationEngineCacheForTests,
  validateCanonicalBeforePersist,
} from "./canonical-validation";

describe("buildValidatedCanonicalDocument (P0-CRIT-01b)", () => {
  const originalCreate = PlatformWizardEngine.create;
  let restoreCreate: (() => void) | null = null;

  afterEach(() => {
    restoreCreate?.();
    restoreCreate = null;
  });

  function trackEngineCreate(): { engines: PlatformWizardEngine[]; createCount: number } {
    const engines: PlatformWizardEngine[] = [];
    let createCount = 0;
    PlatformWizardEngine.create = ((plugin, options) => {
      createCount += 1;
      const engine = originalCreate(plugin, options);
      engines.push(engine);
      return engine;
    }) as typeof PlatformWizardEngine.create;
    restoreCreate = () => {
      PlatformWizardEngine.create = originalCreate;
    };
    return {
      get engines() {
        return engines;
      },
      get createCount() {
        return createCount;
      },
    };
  }

  it("creates PlatformWizardEngine per tenant+workspaceType+variant (DEC-030 LRU)", () => {
    resetValidationEngineCacheForTests();
    const tracker = trackEngineCreate();

    buildValidatedCanonicalDocument(
      { data: { basics: { title: "Tenant A tour" }, details: { summary: "a" } } },
      "tenant-a"
    );
    buildValidatedCanonicalDocument(
      { data: { basics: { title: "Tenant B tour" }, details: { summary: "b" } } },
      "tenant-b"
    );
    assert.equal(tracker.createCount, 2, "distinct tenants must not share a cached engine");

    buildValidatedCanonicalDocument(
      { data: { basics: { title: "Tenant A again" }, details: { summary: "a2" } } },
      "tenant-a"
    );
    assert.equal(tracker.createCount, 2, "same tenant reuses cached engine");

    validateCanonicalBeforePersist({
      body: { data: { basics: { title: "Basic variant" }, details: { summary: "" } } },
      tenantId: "tenant-c",
      workspaceType: "starter",
      validationVariant: "basic",
    });
    assert.equal(tracker.createCount, 3, "distinct validationVariant must create a new engine");
    assert.notEqual(
      tracker.engines[0],
      tracker.engines[2],
      "engines must not be reused across variants"
    );
  });

  it("keeps tenant A and tenant B canonical data isolated back-to-back", () => {
    const docA = buildValidatedCanonicalDocument(
      { data: { basics: { title: "Only tenant A" }, details: { summary: "" } } },
      "tenant-a"
    );
    const docB = buildValidatedCanonicalDocument(
      { data: { basics: { title: "Only tenant B" }, details: { summary: "" } } },
      "tenant-b"
    );

    assert.equal(docA.data?.basics?.title, "Only tenant A");
    assert.equal(docB.data?.basics?.title, "Only tenant B");
  });

  it("does not leak prior tenant validation after many tenant-a calls", () => {
    for (let i = 0; i < 32; i += 1) {
      buildValidatedCanonicalDocument(
        {
          data: {
            basics: { title: `A-${i}` },
            details: { summary: "" },
          },
        },
        "tenant-a"
      );
    }

    const docB = buildValidatedCanonicalDocument(
      { data: { basics: { title: "B-after-burst-A" }, details: { summary: "" } } },
      "tenant-b"
    );
    assert.equal(docB.data?.basics?.title, "B-after-burst-A");
  });
});
