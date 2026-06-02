import assert from "node:assert/strict";
import test from "node:test";

import type { TenantWizardTemplateEnvelope } from "@/features/tours/wizard/template/tenant-wizard-template.types";

import {
  debugWorkspaceTourFormProfileResolution,
  findTourFormProfileValuePaths,
  resolveWorkspaceTourFormProfileFromTemplate,
} from "./resolveWorkspaceTourFormProfile";

test("resolveWorkspaceTourFormProfileFromTemplate: template.baseProfile", () => {
  assert.equal(
    resolveWorkspaceTourFormProfileFromTemplate({
      template: {
        id: "t1",
        workspaceId: "w1",
        baseProfile: "urban_event",
        stepOverrides: { skip: [], insert: [] },
        fieldRulesOverlay: {},
        presetId: null,
        canonicalData: {},
        wizardContractVersion: 1,
        formProfileVersion: 1,
      },
    }),
    "urban_event",
  );
});

test("resolveWorkspaceTourFormProfileFromTemplate: snake_case base_profile on template row", () => {
  assert.equal(
    resolveWorkspaceTourFormProfileFromTemplate({
      id: "t1",
      workspaceId: "w1",
      base_profile: "urban_event",
    } as never),
    "urban_event",
  );
});

test("resolveWorkspaceTourFormProfileFromTemplate: workspaceSettings.profile fallback", () => {
  assert.equal(
    resolveWorkspaceTourFormProfileFromTemplate({
      template: {
        id: "t1",
        workspaceId: "w1",
        workspaceSettings: { profile: "urban_event" },
      },
    } as unknown as TenantWizardTemplateEnvelope),
    "urban_event",
  );
});

test("findTourFormProfileValuePaths: locates nested urban_event", () => {
  const paths = findTourFormProfileValuePaths({
    template: { base_profile: "urban_event", canonicalData: { formProfile: "urban_event" } },
  });
  assert.ok(paths.includes("template.base_profile"));
});

test("debugWorkspaceTourFormProfileResolution: reports canonicalData fallback source", () => {
  const debug = debugWorkspaceTourFormProfileResolution({
    template: {
      id: "t1",
      workspaceId: "w1",
      canonicalData: { formProfile: "urban_event" },
    },
  } as unknown as TenantWizardTemplateEnvelope);
  assert.equal(debug.chosen, "urban_event");
  assert.equal(debug.source, "canonicalData.formProfile");
});
