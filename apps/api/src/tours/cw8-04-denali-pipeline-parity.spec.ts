/**
 * CW8-04 — Denali pipeline migration parity via CW0-07 publish goldens.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { projectDenaliWizardFormToCanonicalIngressData } from "@app-tour/workspace-denali";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { createDenaliTourWorkspacePolicyValidator } from "@app-tour/workspace-denali/policy/tour-policy";

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

function denaliPublishBody(form: Record<string, unknown>) {
  const plugin = getDenaliWorkspacePlugin();
  (form.basicInfo as Record<string, unknown>).publishStatus = "active";
  return {
    schemaVersion: 1,
    roots: [...plugin.wizard.roots],
    data: projectDenaliWizardFormToCanonicalIngressData(form),
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

describe("cw8-04-denali-pipeline-parity", () => {
  const prevPipeline = process.env.WORKSPACE_VALIDATION_PIPELINE;
  const prevDenaliPolicy = process.env.WORKSPACE_VALIDATION_PIPELINE_DENALI_POLICY;
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
    if (prevDenaliPolicy === undefined) {
      delete process.env.WORKSPACE_VALIDATION_PIPELINE_DENALI_POLICY;
    } else {
      process.env.WORKSPACE_VALIDATION_PIPELINE_DENALI_POLICY = prevDenaliPolicy;
    }
    if (prevWorkers === undefined) {
      delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    } else {
      process.env.P5_VALIDATION_WORKERS_ENABLED = prevWorkers;
    }
  });

  it("Denali policy module declares supersedesFlatHooks", () => {
    const validator = createDenaliTourWorkspacePolicyValidator();
    assert.equal(validator.supersedesFlatHooks, true);
    assert.equal(typeof validator.validate, "function");
  });

  it("legacy and Denali-policy pipeline agree for tour-publish-ready golden (CW0-07)", async () => {
    const form = loadGoldenForm("tour-publish-ready.json");
    const input = {
      tenantId: "cw8-04-denali-tenant",
      workspaceType: "denali",
      body: denaliPublishBody(form),
      validationMode: "publish" as const,
    };

    delete process.env.WORKSPACE_VALIDATION_PIPELINE;
    delete process.env.WORKSPACE_VALIDATION_PIPELINE_DENALI_POLICY;
    const legacy = await runPersistValidation(input);

    process.env.WORKSPACE_VALIDATION_PIPELINE = "1";
    process.env.WORKSPACE_VALIDATION_PIPELINE_DENALI_POLICY = "1";
    resetValidationEngineCacheForTests();
    const pipeline = await runPersistValidation(input);

    assert.deepEqual(pipeline, legacy);
    assert.equal(legacy.ok, true);
  });

  it("legacy and Denali-policy pipeline agree for tour-minimal publish failure (CW0-07)", async () => {
    const form = loadGoldenForm("tour-minimal.json");
    const input = {
      tenantId: "cw8-04-denali-fail-tenant",
      workspaceType: "denali",
      body: denaliPublishBody(form),
      validationMode: "publish" as const,
    };

    delete process.env.WORKSPACE_VALIDATION_PIPELINE;
    delete process.env.WORKSPACE_VALIDATION_PIPELINE_DENALI_POLICY;
    const legacy = await runPersistValidation(input);

    process.env.WORKSPACE_VALIDATION_PIPELINE = "1";
    process.env.WORKSPACE_VALIDATION_PIPELINE_DENALI_POLICY = "1";
    resetValidationEngineCacheForTests();
    const pipeline = await runPersistValidation(input);

    assert.deepEqual(pipeline, legacy);
    assert.equal(legacy.ok, false);
  });
});
