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

function urbanPublishBody(golden: { schemaVersion: number; roots: string[]; data: Record<string, unknown> }) {
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
  const prevWorkers = process.env.P5_VALIDATION_WORKERS_ENABLED;

  beforeEach(() => {
    process.env.P5_VALIDATION_WORKERS_ENABLED = "false";
    resetValidationEngineCacheForTests();
  });

  afterEach(() => {
    resetValidationEngineCacheForTests();
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

  it("urban-tour-publish-ready golden passes", async () => {
    const golden = loadGoldenDocument("urban-tour-publish-ready.json");
    const result = await runPersistValidation({
      tenantId: "cw8-05-urban-tenant",
      workspaceType: "urban",
      body: urbanPublishBody(golden),
      validationMode: "publish" as const,
    });
    assert.equal(result.ok, true);
  });

  it("urban capacity violation", async () => {
    const golden = loadGoldenDocument("urban-tour-minimal.json");
    const data = structuredClone(golden.data) as Record<string, unknown>;
    (data.tour as Record<string, unknown>).capacity = 99_999;
    const result = await runPersistValidation({
      tenantId: "cw8-05-urban-cap-tenant",
      workspaceType: "urban",
      body: {
        schemaVersion: golden.schemaVersion,
        roots: [...golden.roots],
        data,
      },
    });
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.message, /URBAN_CAPACITY_OUT_OF_RANGE/);
  });

  it("forbidden itinerary golden fails", async () => {
    const golden = loadGoldenDocument("urban-tour-invalid-itinerary.json");
    const result = await runPersistValidation({
      tenantId: "cw8-05-urban-itin-tenant",
      workspaceType: "urban",
      body: {
        schemaVersion: golden.schemaVersion,
        roots: [...golden.roots],
        data: golden.data,
      },
    });
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.message, /URBAN_FORBIDDEN_ITINERARY/);
  });

  it("transportModes root unknown fails at shared stage", async () => {
    const plugin = getUrbanWorkspacePlugin();
    const result = await runPersistValidation({
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
    });
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.message, /CANONICAL_ROOT_UNKNOWN/);
  });
});
