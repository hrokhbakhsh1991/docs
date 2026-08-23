import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { PlatformWizardEngine } from "@app-tour/platform-core";

import {
  buildValidatedCanonicalDocument,
  resetValidationEngineCacheForTests,
  validateCanonicalBeforePersist,
} from "./canonical-validation";
import { resetValidationWorkerPoolForTests } from "../canonical/validation-worker-pool";

describe("buildValidatedCanonicalDocument (P0-CRIT-01b)", () => {
  const originalCreate = PlatformWizardEngine.create;
  const prevWorkersEnabled = process.env.P5_VALIDATION_WORKERS_ENABLED;
  let restoreCreate: (() => void) | null = null;

  afterEach(async () => {
    restoreCreate?.();
    restoreCreate = null;
    await resetValidationWorkerPoolForTests();
    if (prevWorkersEnabled === undefined) {
      delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    } else {
      process.env.P5_VALIDATION_WORKERS_ENABLED = prevWorkersEnabled;
    }
  });

  beforeEach(() => {
    process.env.P5_VALIDATION_WORKERS_ENABLED = "false";
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

  it("creates PlatformWizardEngine per tenant+workspaceType+variant (DEC-030 LRU)", async () => {
    resetValidationEngineCacheForTests();
    const tracker = trackEngineCreate();

    await buildValidatedCanonicalDocument(
      { data: { basics: { title: "Tenant A tour" }, details: { summary: "a" } } },
      "tenant-a",
      "starter"
    );
    await buildValidatedCanonicalDocument(
      { data: { basics: { title: "Tenant B tour" }, details: { summary: "b" } } },
      "tenant-b",
      "starter"
    );
    assert.equal(tracker.createCount, 2, "distinct tenants must not share a cached engine");

    await buildValidatedCanonicalDocument(
      { data: { basics: { title: "Tenant A again" }, details: { summary: "a2" } } },
      "tenant-a",
      "starter"
    );
    assert.equal(tracker.createCount, 2, "same tenant reuses cached engine");

    await validateCanonicalBeforePersist({
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

  it("keeps tenant A and tenant B canonical data isolated back-to-back", async () => {
    const docA = await buildValidatedCanonicalDocument(
      { data: { basics: { title: "Only tenant A" }, details: { summary: "" } } },
      "tenant-a",
      "starter"
    );
    const docB = await buildValidatedCanonicalDocument(
      { data: { basics: { title: "Only tenant B" }, details: { summary: "" } } },
      "tenant-b",
      "starter"
    );

    assert.equal(docA.data?.basics?.title, "Only tenant A");
    assert.equal(docB.data?.basics?.title, "Only tenant B");
  });

  it("does not leak prior tenant validation after many tenant-a calls", async () => {
    for (let i = 0; i < 32; i += 1) {
      await buildValidatedCanonicalDocument(
        {
          data: {
            basics: { title: `A-${i}` },
            details: { summary: "" },
          },
        },
        "tenant-a",
        "starter"
      );
    }

    const docB = await buildValidatedCanonicalDocument(
      { data: { basics: { title: "B-after-burst-A" }, details: { summary: "" } } },
      "tenant-b",
      "starter"
    );
    assert.equal(docB.data?.basics?.title, "B-after-burst-A");
  });

  it("requires callers to pass workspaceType explicitly", () => {
    const source = readFileSync(join(import.meta.dirname, "canonical-validation.ts"), "utf8");
    assert.doesNotMatch(source, /workspaceType\s*=\s*["']starter["']/);
    assert.match(source, /workspaceType:\s*string/);
  });
});
