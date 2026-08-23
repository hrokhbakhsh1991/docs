/**
 * CW8-02 — flag off/on parity for legacy vs pipeline validation paths.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { projectDenaliWizardFormToCanonicalIngressData } from "@app-tour/workspace-denali";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { getUrbanWorkspacePlugin } from "@app-tour/workspace-urban";

import { isValidationFailure } from "../canonical/validation-failure.ts";
import {
  resetValidationEngineCacheForTests,
  validateCanonicalBeforePersistSync,
} from "./canonical-validation-sync.ts";

const GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../packages/workspaces/denali/test/fixtures/golden"
);

function loadGoldenForm(filename: string): Record<string, unknown> {
  const raw = JSON.parse(readFileSync(join(GOLDEN_DIR, filename), "utf8")) as Record<
    string,
    unknown
  >;
  const { _templateOverlay: _ignored, ...form } = raw;
  return form;
}

function denaliCreateBody(form: Record<string, unknown>) {
  const plugin = getDenaliWorkspacePlugin();
  return {
    schemaVersion: 1,
    roots: [...plugin.wizard.roots],
    data: projectDenaliWizardFormToCanonicalIngressData(form),
  };
}

function urbanCreateBody(overrides: Record<string, unknown> = {}) {
  const plugin = getUrbanWorkspacePlugin();
  return {
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
      },
      tripDetails: { mode: "walk" },
      ...overrides,
    },
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

describe("cw8-02-flag-parity", () => {
  const prevPipeline = process.env.WORKSPACE_VALIDATION_PIPELINE;
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
    if (prevWorkers === undefined) {
      delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    } else {
      process.env.P5_VALIDATION_WORKERS_ENABLED = prevWorkers;
    }
  });

  it("flag off and flag on agree for starter draft create", async () => {
    const input = {
      tenantId: "cw8-02-starter-tenant",
      workspaceType: "starter",
      body: {
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: { basics: { title: "Starter tour" }, details: { summary: "ok" } },
      },
    };

    delete process.env.WORKSPACE_VALIDATION_PIPELINE;
    const legacy = await runPersistValidation(input);

    process.env.WORKSPACE_VALIDATION_PIPELINE = "1";
    resetValidationEngineCacheForTests();
    const pipeline = await runPersistValidation(input);

    assert.deepEqual(pipeline, legacy);
  });

  it("flag off and flag on agree for Denali publish-ready golden", async () => {
    const form = loadGoldenForm("tour-publish-ready.json");
    (form.basicInfo as Record<string, unknown>).publishStatus = "active";
    const input = {
      tenantId: "cw8-02-denali-tenant",
      workspaceType: "denali",
      body: denaliCreateBody(form),
      validationMode: "publish" as const,
    };

    delete process.env.WORKSPACE_VALIDATION_PIPELINE;
    const legacy = await runPersistValidation(input);

    process.env.WORKSPACE_VALIDATION_PIPELINE = "1";
    resetValidationEngineCacheForTests();
    const pipeline = await runPersistValidation(input);

    assert.deepEqual(pipeline, legacy);
  });

  it("flag off and flag on agree for Denali publish failure (tour-minimal active)", async () => {
    const form = loadGoldenForm("tour-minimal.json");
    (form.basicInfo as Record<string, unknown>).publishStatus = "active";
    const input = {
      tenantId: "cw8-02-denali-fail-tenant",
      workspaceType: "denali",
      body: denaliCreateBody(form),
      validationMode: "publish" as const,
    };

    delete process.env.WORKSPACE_VALIDATION_PIPELINE;
    const legacy = await runPersistValidation(input);

    process.env.WORKSPACE_VALIDATION_PIPELINE = "1";
    resetValidationEngineCacheForTests();
    const pipeline = await runPersistValidation(input);

    assert.deepEqual(pipeline, legacy);
    assert.equal(legacy.ok, false);
  });

  it("flag off and flag on agree for Urban capacity violation", async () => {
    const input = {
      tenantId: "cw8-02-urban-tenant",
      workspaceType: "urban",
      body: urbanCreateBody({
        tour: {
          title: "Urban tour",
          city: "Seattle",
          venueName: "Venue",
          startDate: "2026-06-01",
          endDate: "2026-06-02",
          capacity: 99_999,
          status: "draft",
        },
      }),
    };

    delete process.env.WORKSPACE_VALIDATION_PIPELINE;
    const legacy = await runPersistValidation(input);

    process.env.WORKSPACE_VALIDATION_PIPELINE = "1";
    resetValidationEngineCacheForTests();
    const pipeline = await runPersistValidation(input);

    assert.deepEqual(pipeline, legacy);
    assert.equal(legacy.ok, false);
    assert.match(legacy.ok ? "" : legacy.message, /URBAN_CAPACITY_OUT_OF_RANGE/);
  });

  it("flag off and flag on agree for Urban forbidden itinerary", async () => {
    const input = {
      tenantId: "cw8-02-urban-itinerary-tenant",
      workspaceType: "urban",
      body: urbanCreateBody({
        tripDetails: { itinerary: { inactive: true } },
      }),
    };

    delete process.env.WORKSPACE_VALIDATION_PIPELINE;
    const legacy = await runPersistValidation(input);

    process.env.WORKSPACE_VALIDATION_PIPELINE = "1";
    resetValidationEngineCacheForTests();
    const pipeline = await runPersistValidation(input);

    assert.deepEqual(pipeline, legacy);
    assert.equal(legacy.ok, false);
    assert.match(legacy.ok ? "" : legacy.message, /URBAN_FORBIDDEN_ITINERARY/);
  });
});
