/**
 * P5-B-N-005 — draft vs publish validation (VAL-01..03)
 * @see docs/phase-18/platform-denali-operator-parity.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  projectDenaliWizardFormToCanonicalIngressData,
} from "@app-tour/workspace-denali";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";
import { stripWorkspacePluginToDefinitionPayload } from "@app-tour/workspace-sdk/metadata";

import { adaptMetadataPayloadToWorkspacePlugin } from "../src/workspace-metadata/metadata-plugin-adapter.ts";
import { isValidationFailure } from "../src/canonical/validation-failure.ts";
import {
  resetValidationEngineCacheForTests,
  validateCanonicalBeforePersistSync,
} from "../src/tours/canonical-validation-sync.ts";
import {
  resolveValidationMode,
  runValidationModePublishGate,
} from "../src/tours/resolve-validation-mode.ts";
import { createCanonicalDocument } from "@app-tour/workspace-sdk";

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

describe("canonical-validation-draft-vs-publish (P5-B VAL-01..03)", () => {
  beforeEach(() => {
    process.env.P5_VALIDATION_WORKERS_ENABLED = "false";
    resetValidationEngineCacheForTests();
  });

  afterEach(() => {
    delete process.env.P5_VALIDATION_WORKERS_ENABLED;
    resetValidationEngineCacheForTests();
  });

  it("VAL-01 draft create relaxed — publish gate skipped in draft mode", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const form = loadGoldenForm("tour-minimal.json");
    (form.basicInfo as Record<string, unknown>).publishStatus = "active";
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: [...plugin.wizard.roots],
      data: projectDenaliWizardFormToCanonicalIngressData(form),
    });

    assert.equal(runValidationModePublishGate(plugin, document, "draft"), null);
    assert.notEqual(runValidationModePublishGate(plugin, document, "publish"), null);
  });

  it("VAL-02 publish strict on golden — publish-ready passes publish gate", async () => {
    const plugin = getDenaliWorkspacePlugin();
    const form = loadGoldenForm("tour-publish-ready.json");
    (form.basicInfo as Record<string, unknown>).publishStatus = "active";
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: [...plugin.wizard.roots],
      data: projectDenaliWizardFormToCanonicalIngressData(form),
    });

    assert.equal(runValidationModePublishGate(plugin, document, "publish"), null);
  });

  it("VAL-02 publish strict — tour-minimal active fails publish readiness", async () => {
    const form = loadGoldenForm("tour-minimal.json");
    (form.basicInfo as Record<string, unknown>).publishStatus = "active";

    await assert.rejects(() =>
        validateCanonicalBeforePersistSync({
          tenantId: "val-02b-tenant",
          workspaceType: "denali",
          body: denaliCreateBody(form),
          validationMode: "publish",
        }),
      (error: unknown) => {
        assert.ok(isValidationFailure(error));
        assert.match((error as Error).message, /CANONICAL_VALIDATION_FAILED/);
        return true;
      }
    );
  });

  it("VAL-03m metadata-adapted plugin matches package publish gate", async () => {
    const packagePlugin = getDenaliWorkspacePlugin();
    const seedPayload = stripWorkspacePluginToDefinitionPayload(packagePlugin);
    const metadataPlugin = adaptMetadataPayloadToWorkspacePlugin(seedPayload, packagePlugin);

    const form = loadGoldenForm("tour-minimal.json");
    (form.basicInfo as Record<string, unknown>).publishStatus = "active";
    const data = projectDenaliWizardFormToCanonicalIngressData(form);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: [...packagePlugin.wizard.roots],
      data,
    });

    const packageViolation = runValidationModePublishGate(
      packagePlugin,
      document,
      "publish"
    );
    const metadataViolation = runValidationModePublishGate(
      metadataPlugin,
      document,
      "publish"
    );

    assert.ok(packageViolation != null);
    assert.equal(metadataViolation?.code, packageViolation?.code);
  });

  it("VAL-04 publish-ready golden passes full validateCanonicalBeforePersistSync", async () => {
    const form = loadGoldenForm("tour-publish-ready.json");
    (form.basicInfo as Record<string, unknown>).publishStatus = "active";

    const document = await validateCanonicalBeforePersistSync({
      tenantId: "val-04-tenant",
      workspaceType: "denali",
      body: denaliCreateBody(form),
      validationMode: "publish",
    });

    assert.equal((document.data as Record<string, unknown>).title, "صعود به قله دماوند - جبهه جنوبی");
  });

  it("VAL-05 INV-DENALI-INGRESS-002 — scalar composite rich storage passes engine filter", async () => {
    const form = loadGoldenForm("tour-publish-ready.json");
    const basicInfo = form.basicInfo as Record<string, unknown>;
    basicInfo.publishStatus = "active";
    basicInfo.startPoint = {
      address: "ده نمک, استان سمنان, ایران",
      latitude: 35.24710863527999,
      longitude: 52.71446228027344,
    };
    const participantRequirements = form.participantRequirements as Record<string, unknown>;
    participantRequirements.minRequiredPeaks = 3;

    assert.doesNotThrow(() =>
      await validateCanonicalBeforePersistSync({
        tenantId: "val-05-tenant",
        workspaceType: "denali",
        body: denaliCreateBody(form),
        validationMode: "publish",
      })
    );
  });

  it("resolveValidationMode infers publish from active publishStatus", async () => {
    const form = loadGoldenForm("tour-publish-ready.json");
    (form.basicInfo as Record<string, unknown>).publishStatus = "active";
    const body = denaliCreateBody(form);
    const document = createCanonicalDocument({
      schemaVersion: 1,
      roots: body.roots,
      data: body.data,
    });

    assert.equal(
      resolveValidationMode(
        { tenantId: "t", workspaceType: "denali", body },
        document
      ),
      "publish"
    );
  });
});
