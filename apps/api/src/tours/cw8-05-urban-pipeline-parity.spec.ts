/**
 * CW8-05 — Urban pipeline migration parity via urban golden fixtures.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getUrbanWorkspacePlugin } from "@app-tour/workspace-urban";
import { createUrbanTourWorkspacePolicyValidator } from "@app-tour/workspace-urban/policy/tour-policy";

import { isValidationFailure } from "../canonical/validation-failure.ts";
import {
  resetValidationEngineCacheForTests,
  validateCanonicalBeforePersistSync,
} from "./canonical-validation-sync.ts";

const GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../packages/workspaces/urban/test/fixtures/golden"
);

function loadGoldenDocument(filename: string) {
  return JSON.parse(readFileSync(join(GOLDEN_DIR, filename), "utf8")) as {
    schemaVersion: number;
    roots: string[];
    data: Record<string, unknown>;
  };
}

function urbanPublishBody(golden: ReturnType<typeof loadGoldenDocument>) {
  const data = structuredClone(golden.data) as Record<string, unknown>;
  const tour = data.tour as Record<string, unknown>;
  tour.publishStatus = "published";
  tour.status = "published";
  return {
    schemaVersion: golden.schemaVersion,
    roots: [...golden.roots],
    data,
  };
}

async function runPersistValidation(
  input: Parameters<typeof validateCanonicalBeforePersistSync>[0]
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await validateCanonicalBeforePersistSync(input);
    return { ok: true };
  } catch (error) {
    if (isValidationFailure(error)) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}

describe("cw8-05-urban-pipeline-parity", () => {
  const prevPipeline = process.env.WORKSPACE_VALIDATION_PIPELINE;
  const prevUrbanPolicy = process.env.WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY;
  const prevWorkers = process.env.P5_VALIDATION_WORKERS_ENABLED;

  beforeEach(() => {
    process.env.P5_VALIDATION_WORKERS_ENABLED = "false";
    resetValidationEngineCacheForTests();
  });

  afterEach(() => {
    resetValidationEngineCacheForTests();
    if (prevPipeline === undefined) {
      delete process.env.WORKSPACE_VALIDATION_PIPELINE;
    } else {
      process.env.WORKSPACE_VALIDATION_PIPELINE = prevPipeline;
    }
    if (prevUrbanPolicy === undefined) {
      delete process.env.WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY;
    } else {
      process.env.WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY = prevUrbanPolicy;
    }
    if (prevWorkers === undefined) {
      delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    } else {
      process.env.P5_VALIDATION_WORKERS_ENABLED = prevWorkers;
    }
  });

  it("Urban policy module declares supersedesFlatHooks", () => {
    const validator = createUrbanTourWorkspacePolicyValidator();
    assert.equal(validator.supersedesFlatHooks, true);
    assert.equal(typeof validator.validate, "function");
  });

  it("legacy and Urban-policy pipeline agree for urban-tour-publish-ready golden", async () => {
    const golden = loadGoldenDocument("urban-tour-publish-ready.json");
    const input = {
      tenantId: "cw8-05-urban-tenant",
      workspaceType: "urban",
      body: urbanPublishBody(golden),
      validationMode: "publish" as const,
    };

    delete process.env.WORKSPACE_VALIDATION_PIPELINE;
    delete process.env.WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY;
    const legacy = await runPersistValidation(input);

    process.env.WORKSPACE_VALIDATION_PIPELINE = "1";
    process.env.WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY = "1";
    resetValidationEngineCacheForTests();
    const pipeline = await runPersistValidation(input);

    assert.deepEqual(pipeline, legacy);
    assert.equal(legacy.ok, true);
  });

  it("legacy and Urban-policy pipeline agree for urban capacity violation", async () => {
    const golden = loadGoldenDocument("urban-tour-minimal.json");
    const data = structuredClone(golden.data) as Record<string, unknown>;
    (data.tour as Record<string, unknown>).capacity = 99_999;
    const input = {
      tenantId: "cw8-05-urban-cap-tenant",
      workspaceType: "urban",
      body: {
        schemaVersion: golden.schemaVersion,
        roots: [...golden.roots],
        data,
      },
    };

    delete process.env.WORKSPACE_VALIDATION_PIPELINE;
    delete process.env.WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY;
    const legacy = await runPersistValidation(input);

    process.env.WORKSPACE_VALIDATION_PIPELINE = "1";
    process.env.WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY = "1";
    resetValidationEngineCacheForTests();
    const pipeline = await runPersistValidation(input);

    assert.deepEqual(pipeline, legacy);
    assert.equal(legacy.ok, false);
    assert.match(legacy.ok ? "" : legacy.message, /URBAN_CAPACITY_OUT_OF_RANGE/);
  });

  it("legacy and Urban-policy pipeline agree for forbidden itinerary golden", async () => {
    const golden = loadGoldenDocument("urban-tour-invalid-itinerary.json");
    const input = {
      tenantId: "cw8-05-urban-itin-tenant",
      workspaceType: "urban",
      body: {
        schemaVersion: golden.schemaVersion,
        roots: [...golden.roots],
        data: golden.data,
      },
    };

    delete process.env.WORKSPACE_VALIDATION_PIPELINE;
    delete process.env.WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY;
    const legacy = await runPersistValidation(input);

    process.env.WORKSPACE_VALIDATION_PIPELINE = "1";
    process.env.WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY = "1";
    resetValidationEngineCacheForTests();
    const pipeline = await runPersistValidation(input);

    assert.deepEqual(pipeline, legacy);
    assert.equal(legacy.ok, false);
    assert.match(legacy.ok ? "" : legacy.message, /URBAN_FORBIDDEN_ITINERARY/);
  });

  it("legacy and Urban-policy pipeline agree when transportModes root is unknown (shared stage)", async () => {
    const plugin = getUrbanWorkspacePlugin();
    const input = {
      tenantId: "cw8-05-urban-transport-tenant",
      workspaceType: "urban",
      body: {
        schemaVersion: 1,
        roots: [...plugin.wizard.roots],
        data: {
          tour: {
            title: "Urban tour",
            city: "Seattle",
            venueName: "Venue",
            startDate: "2026-06-01",
            endDate: "2026-06-02",
            capacity: 10,
            status: "draft",
            publishStatus: "draft",
          },
          transportModes: ["bus"],
        },
      },
    };

    delete process.env.WORKSPACE_VALIDATION_PIPELINE;
    delete process.env.WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY;
    const legacy = await runPersistValidation(input);

    process.env.WORKSPACE_VALIDATION_PIPELINE = "1";
    process.env.WORKSPACE_VALIDATION_PIPELINE_URBAN_POLICY = "1";
    resetValidationEngineCacheForTests();
    const pipeline = await runPersistValidation(input);

    assert.deepEqual(pipeline, legacy);
    assert.equal(legacy.ok, false);
    assert.match(legacy.ok ? "" : legacy.message, /CANONICAL_ROOT_UNKNOWN/);
  });
});
