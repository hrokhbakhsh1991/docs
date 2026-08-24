/**
 * CW8-02 / CW8-06 — pipeline validation regression (legacy flat persist path retired).
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
  "../../../../packages/workspaces/denali/test/fixtures/golden"
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
        publishStatus: "draft",
        ...((overrides.tour as Record<string, unknown> | undefined) ?? {}),
      },
      ...Object.fromEntries(
        Object.entries(overrides).filter(([key]) => key !== "tour")
      ),
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

describe("cw8-02-pipeline-regression", () => {
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

  it("starter draft create passes via pipeline", async () => {
    const result = await runPersistValidation({
      tenantId: "cw8-02-starter-tenant",
      workspaceType: "starter",
      body: {
        schemaVersion: 1,
        roots: ["basics", "details"],
        data: { basics: { title: "Starter tour" }, details: { summary: "ok" } },
      },
    });
    assert.equal(result.ok, true);
  });

  it("Denali publish-ready golden passes via pipeline", async () => {
    const form = loadGoldenForm("tour-publish-ready.json");
    (form.basicInfo as Record<string, unknown>).publishStatus = "active";
    const result = await runPersistValidation({
      tenantId: "cw8-02-denali-tenant",
      workspaceType: "denali",
      body: denaliCreateBody(form),
      validationMode: "publish" as const,
    });
    assert.equal(result.ok, true);
  });

  it("Denali publish failure (tour-minimal active) via pipeline", async () => {
    const form = loadGoldenForm("tour-minimal.json");
    (form.basicInfo as Record<string, unknown>).publishStatus = "active";
    const result = await runPersistValidation({
      tenantId: "cw8-02-denali-fail-tenant",
      workspaceType: "denali",
      body: denaliCreateBody(form),
      validationMode: "publish" as const,
    });
    assert.equal(result.ok, false);
  });

  it("Urban capacity violation via pipeline", async () => {
    const result = await runPersistValidation({
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
          publishStatus: "draft",
        },
      }),
    });
    assert.equal(result.ok, false);
    assert.match(result.ok ? "" : result.message, /URBAN_CAPACITY_OUT_OF_RANGE/);
  });
});
