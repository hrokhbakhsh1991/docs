import assert from "node:assert/strict";
import test from "node:test";

import {
  allowedTourCreateWireKeysForTenant,
  getVisibleWizardStepsForTenantContract,
  isFieldVisibleForTenantContract,
  mergeWizardValidationFlagsWithTenant,
  resolveTenantTourFormContract,
  stripTenantGatedTourCreateGroups,
  tenantModuleWizardValidationFlags,
} from "./tenant-tour-form-contract";
import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";
import { validateForSubmit } from "@/features/tours/wizard/profileRules/validation";

test("resolveTenantTourFormContract enables finance and form_builder surfaces", () => {
  const c = resolveTenantTourFormContract(["finance", "form_builder"]);
  assert.equal(c.allowFinanceSurfaces, true);
  assert.equal(c.allowAdvancedTripDetails, true);
  assert.deepEqual(c.tenantModules, ["finance", "form_builder"]);
});

test("resolveTenantTourFormContract ignores unknown module ids", () => {
  const c = resolveTenantTourFormContract(["finance", "unknown_module"]);
  assert.deepEqual(c.tenantModules, ["finance"]);
  assert.equal(c.allowFinanceSurfaces, true);
  assert.equal(c.allowAdvancedTripDetails, false);
});

test("allowedTourCreateWireKeysForTenant returns shared contract fields", () => {
  const c = resolveTenantTourFormContract([]);
  const keys = allowedTourCreateWireKeysForTenant(c);
  assert.ok(keys.includes("title"));
  assert.ok(keys.length > 5);
});

test("finance-only tenant hides advanced trip fields and wizard steps", () => {
  const c = resolveTenantTourFormContract(["finance"]);
  assert.equal(isFieldVisibleForTenantContract("overview.title", c), true);
  assert.equal(isFieldVisibleForTenantContract("itinerary.days", c), false);
  assert.equal(isFieldVisibleForTenantContract("participation.minimumAge", c), false);
  assert.equal(isFieldVisibleForTenantContract("logistics.primaryTransportMode", c), false);

  const steps = getVisibleWizardStepsForTenantContract("mountain_outdoor", c);
  assert.ok(!steps.includes("itinerary"));
  assert.ok(!steps.includes("participation"));
  assert.ok(!steps.includes("logistics"));
  assert.ok(steps.includes("basic"));
  assert.ok(steps.includes("review"));
});

test("tenantModuleWizardValidationFlags relaxes itinerary and logistics without form_builder", () => {
  const financeOnly = resolveTenantTourFormContract(["finance"]);
  const withBuilder = resolveTenantTourFormContract(["finance", "form_builder"]);
  assert.deepEqual(tenantModuleWizardValidationFlags(financeOnly), {
    relaxItineraryMinDays: true,
    relaxLogisticsPrimary: true,
  });
  assert.deepEqual(tenantModuleWizardValidationFlags(withBuilder), {
    relaxItineraryMinDays: false,
    relaxLogisticsPrimary: false,
  });
  assert.deepEqual(
    mergeWizardValidationFlagsWithTenant(
      { relaxItineraryMinDays: false, relaxLogisticsPrimary: false },
      financeOnly,
    ),
    { relaxItineraryMinDays: true, relaxLogisticsPrimary: true },
  );
});

test("validateForSubmit skips tenant-gated required paths on finance-only workspace", () => {
  const c = resolveTenantTourFormContract(["finance"]);
  const result = validateForSubmit("mountain_outdoor", buildTourCreateFormDefaultValues(), {
    tenantFormContract: c,
  });
  const paths = result.issues.map((i) => i.path);
  assert.ok(!paths.includes("itinerary.days"));
  assert.ok(!paths.includes("logistics.primaryTransportMode"));
  assert.ok(paths.includes("overview.title"));
});

test("stripTenantGatedTourCreateGroups resets itinerary/participation/logistics roots", () => {
  const c = resolveTenantTourFormContract(["finance"]);
  const base = buildTourCreateFormDefaultValues();
  const dirty = {
    ...base,
    itinerary: { ...base.itinerary, days: [{ dayNumber: 1, title: "x", segments: [] }] },
    participation: { ...base.participation, minimumAge: 18 },
    logistics: { ...base.logistics, primaryTransportMode: "bus" as const },
  };
  const out = stripTenantGatedTourCreateGroups(c, dirty);
  assert.deepEqual(out.itinerary, base.itinerary);
  assert.deepEqual(out.participation, base.participation);
  assert.deepEqual(out.logistics, base.logistics);
});
