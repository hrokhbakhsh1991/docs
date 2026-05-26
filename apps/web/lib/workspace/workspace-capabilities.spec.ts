import assert from "node:assert/strict";
import test from "node:test";

import { TOUR_FORM_PROFILE_VALUES, type TourFormProfile } from "@repo/types";

import { getWizardConfig } from "@/features/tours/wizard/workspace-wizard.config";

import {
  getCapabilitiesForProfile,
  usesDenaliWizardShellForProfile,
} from "./workspace-capabilities";

test("usesDenaliWizardShellForProfile matches getWizardConfig wizardMode", () => {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    const caps = getCapabilitiesForProfile(profile);
    const wizard = getWizardConfig(profile);
    assert.equal(
      caps.usesDenaliWizardShell,
      wizard.wizardMode === "denali",
      `wizardMode parity for ${profile}`,
    );
    assert.equal(usesDenaliWizardShellForProfile(profile), caps.usesDenaliWizardShell);
  }
});

test("urban_event: Denali shell, no meals, no root transport, no geo publish", () => {
  const caps = getCapabilitiesForProfile("urban_event");
  assert.equal(caps.usesDenaliWizardShell, true);
  assert.equal(caps.canAddTransport, true);
  assert.equal(caps.canEditRootTransportModes, false);
  assert.equal(caps.canAddMeals, false);
  assert.equal(caps.requiresGeoPublish, false);
  assert.equal(caps.canEditLogisticsFieldGroup, false);
});

test("denali_pilot: geo publish and single-day logistics strip", () => {
  const caps = getCapabilitiesForProfile("denali_pilot");
  assert.equal(caps.requiresGeoPublish, true);
  assert.equal(caps.appliesDenaliSingleDayLogisticsStrip, true);
  assert.equal(caps.allowsMountainOverviewFields, true);
  assert.equal(caps.usesDenaliWizardShell, true);
});

test("denali_pilot: service catalog exposed on web capabilities", () => {
  const caps = getCapabilitiesForProfile("denali_pilot");
  assert.equal(caps.availableServices.length, 2);
  assert.deepEqual(caps.availableServices[0], { id: "breakfast", label: "صبحانه" });
  assert.deepEqual(caps.availableServices[1], { id: "nissan", label: "حمل با نیسان" });
});

test("urban_event: empty service catalog", () => {
  const caps = getCapabilitiesForProfile("urban_event");
  assert.deepEqual(caps.availableServices, []);
});

test("mountain_outdoor: classic shell, mountain overview, full logistics", () => {
  const caps = getCapabilitiesForProfile("mountain_outdoor");
  assert.equal(caps.usesDenaliWizardShell, false);
  assert.equal(caps.allowsMountainOverviewFields, true);
  assert.equal(caps.canAddMeals, true);
  assert.equal(caps.canEditRootTransportModes, true);
});

test("general: classic defaults", () => {
  const caps = getCapabilitiesForProfile("general");
  assert.equal(caps.usesDenaliWizardShell, false);
  assert.equal(caps.requiresGeoPublish, false);
  assert.equal(caps.canAddTransport, true);
  assert.equal(caps.canAddMeals, true);
});

test("nature_trip: arctic workspace validation without Denali shell", () => {
  const caps = getCapabilitiesForProfile("nature_trip");
  assert.equal(caps.usesDenaliWizardShell, false);
  assert.equal(caps.hasWorkspaceValidation, true);
});

test("getCapabilitiesForProfile returns stable cached reference", () => {
  const a = getCapabilitiesForProfile("general");
  const b = getCapabilitiesForProfile("general");
  assert.equal(a, b);
});

test("usesDenaliWizardShellForProfile handles null/empty", () => {
  assert.equal(usesDenaliWizardShellForProfile(null), false);
  assert.equal(usesDenaliWizardShellForProfile(""), false);
});

test("inactive field groups match descriptor via wizard config", () => {
  const profiles: TourFormProfile[] = ["urban_event", "cinema_event", "general"];
  for (const profile of profiles) {
    const caps = getCapabilitiesForProfile(profile);
    const wizard = getWizardConfig(profile);
    assert.deepEqual(caps.inactiveFieldGroups, wizard.inactiveFieldGroups, profile);
  }
});
