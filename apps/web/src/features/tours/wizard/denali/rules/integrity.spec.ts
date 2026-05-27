import assert from "node:assert/strict";
import test from "node:test";

import {
  DENALI_WIZARD_CANONICAL_FIELD_PATHS,
  mapDenaliCanonicalToFormPath,
  readDenaliFormFieldValue,
  writeDenaliFormFieldValue,
} from "./denaliRuleRequired";
import { denaliRuleSet, findDenaliRuleField, listDenaliRuleFieldPaths } from "./denaliRuleModel";
import {
  normalizeDenaliWizardForm,
  resolveDenaliRuleSetFromTemplate,
} from "../validation/denaliRuleAccess";
import {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
} from "./denaliRuleModel";
import { denaliTourKindFromCanonical } from "@repo/types";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

/** Paths that must not be cleared by overlay normalize (would break classification). */
const INTEGRITY_SKIP_CLEAR_PATHS = new Set(["category", "eventVariant", "photos"]);

function overlayTemplateForHiddenPath(path: string): TenantWizardTemplate {
  return {
    id: "t-integrity",
    workspaceId: "w1",
    baseProfile: "denali_pilot",
    stepOverrides: { skip: [], insert: [] },
    fieldRulesOverlay: { [path]: { visibility: "hidden" } },
    presetId: null,
    canonicalData: {},
    wizardContractVersion: 1,
    formProfileVersion: 1,
  };
}

function tourTypeForRulePath(path: string): string | null {
  for (const category of DENALI_RULE_MODEL_CATEGORIES) {
    for (const duration of DENALI_RULE_MODEL_DURATIONS) {
      const model = denaliRuleSet[category][duration];
      if (model == null || findDenaliRuleField(model, path) == null) continue;
      return denaliTourKindFromCanonical({
        category,
        duration,
        eventVariant: category === "event" ? "cinema" : undefined,
      });
    }
  }
  return null;
}

function sentinelForPath(path: string): unknown {
  if (path === "photos") {
    return [
      {
        id: "p1",
        url: "https://example.com/a.jpg",
        filename: "a.jpg",
        size: 1,
        mimeType: "image/jpeg",
        uploadedAt: new Date().toISOString(),
      },
    ];
  }
  if (path === "program.itinerary") {
    return [{ day: 1, activities: "hike" }];
  }
  if (path === "program.themeIds") return ["theme-1"];
  if (path === "leaderUserIds") return ["user-1"];
  if (path === "participants.gearItems") return [{ id: "gear-1", isRequired: true }];
  if (path === "gatheringPoints") {
    return [{ title: "Station A", location: { addressText: "Tehran" } }];
  }
  if (
    path === "startPoint" ||
    path === "summitPoint" ||
    path === "campPoint" ||
    path === "endPoint"
  ) {
    return { addressText: "integrity-zone", latitude: 35.7, longitude: 51.4 };
  }
  if (path === "publishStatus") return "draft";
  if (
    path === "requiresManualAdminApproval" ||
    path === "requiresLocalGuide" ||
    path === "pricing.requiresPayment" ||
    path === "pricing.includesTourInsurance" ||
    path === "transport.allowPersonalCar" ||
    path === "participants.nationalIdRequired" ||
    path === "participants.sportsInsuranceRequired"
  ) {
    return true;
  }
  if (path === "eventVariant") return "cinema";
  if (path.includes("Age") || path.includes("Hours") || path.includes("Level") || path.includes("Cost") || path.includes("Amount") || path.includes("Percentage") || path.includes("deadline")) {
    return 5;
  }
  if (path === "transport.mode") return "bus";
  if (path === "transport.adminCapacityApproval") return true;
  if (path === "pricing.paymentMode") return "offline_receipt";
  if (path === "participants.fitnessLevel") return "medium";
  return "integrity-sentinel";
}

function isClearedValue(path: string, value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim() === "";
  if (typeof value === "boolean") return value === false;
  if (Array.isArray(value)) return value.length === 0;
  if (path === "eventVariant" && value === "reading") return true;
  return false;
}

test("DENALI_WIZARD_CANONICAL_FIELD_PATHS covers every rule-model path", () => {
  const rulePaths = listDenaliRuleFieldPaths();
  const missing = rulePaths.filter((path) => !DENALI_WIZARD_CANONICAL_FIELD_PATHS.has(path));
  assert.equal(
    missing.length,
    0,
    `paths missing from allow-list: ${missing.join(", ")}`,
  );
});

test("every allow-list path has a form path map (except documented virtual fields)", () => {
  for (const path of DENALI_WIZARD_CANONICAL_FIELD_PATHS) {
    const mapped = mapDenaliCanonicalToFormPath(path);
    assert.ok(mapped.length > 0, `missing map for ${path}`);
  }
});

test("overlay hidden eventVariant resets tour kind to event_reading", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "event_cinema";

  const ruleSet = resolveDenaliRuleSetFromTemplate(overlayTemplateForHiddenPath("eventVariant"));
  const normalized = normalizeDenaliWizardForm(form, undefined, ruleSet);

  assert.equal(normalized.basicInfo.tourType, "event_reading");
});

test("normalizeDenaliWizardForm strips overlay-hidden rule-model fields", () => {
  const rulePaths = listDenaliRuleFieldPaths();

  for (const path of rulePaths) {
    if (INTEGRITY_SKIP_CLEAR_PATHS.has(path)) continue;

    const tourType = tourTypeForRulePath(path);
    if (tourType == null) continue;

    const form = buildDenaliTourCreateTestValues();
    form.basicInfo.tourType = tourType as typeof form.basicInfo.tourType;

    writeDenaliFormFieldValue(form, path, sentinelForPath(path));
    assert.ok(
      !isClearedValue(path, readDenaliFormFieldValue(form, path)),
      `precondition: sentinel set for ${path}`,
    );

    const ruleSet = resolveDenaliRuleSetFromTemplate(overlayTemplateForHiddenPath(path));
    const normalized = normalizeDenaliWizardForm(form, undefined, ruleSet);

    assert.ok(
      isClearedValue(path, readDenaliFormFieldValue(normalized, path)),
      `overlay hidden should clear ${path}`,
    );
  }
});
