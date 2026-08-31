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
import { createDenaliTourWorkspacePolicyValidator } from "../workspace/denali-host-legacy-bindings.generated.ts";

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

  it("Denali policy module declares supersedesFlatHooks", () => {
    const validator = createDenaliTourWorkspacePolicyValidator();
    assert.equal(validator.supersedesFlatHooks, true);
    assert.equal(typeof validator.validate, "function");
  });

  it("tour-publish-ready golden passes (CW0-07)", async () => {
    const form = loadGoldenForm("tour-publish-ready.json");
    const result = await runPersistValidation({
      tenantId: "cw8-04-denali-tenant",
      workspaceType: "denali",
      body: denaliPublishBody(form),
      validationMode: "publish" as const,
    });
    assert.equal(result.ok, true);
  });

  it("tour-minimal publish failure (CW0-07)", async () => {
    const form = loadGoldenForm("tour-minimal.json");
    const result = await runPersistValidation({
      tenantId: "cw8-04-denali-fail-tenant",
      workspaceType: "denali",
      body: denaliPublishBody(form),
      validationMode: "publish" as const,
    });
    assert.equal(result.ok, false);
  });
});
