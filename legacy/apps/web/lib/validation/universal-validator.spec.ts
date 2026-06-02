import assert from "node:assert/strict";
import test from "node:test";

import { validateDenaliWorkspaceTemplate } from "./universal-validator";

test("validateDenaliWorkspaceTemplate rejects unknown overlay field path", () => {
  const issues = validateDenaliWorkspaceTemplate({
    fieldRulesOverlay: { not_a_real_denali_field: { visibility: "always" } },
    canonicalData: {},
  });
  assert.ok(issues.some((i) => i.path === "fieldRulesOverlay.not_a_real_denali_field"));
});

test("validateDenaliWorkspaceTemplate rejects invalid visibility enum", () => {
  const issues = validateDenaliWorkspaceTemplate({
    fieldRulesOverlay: { title: { visibility: "sometimes" } },
    canonicalData: {},
  });
  assert.ok(issues.some((i) => i.path.endsWith(".visibility")));
});

test("validateDenaliWorkspaceTemplate accepts partial canonical payload", () => {
  const issues = validateDenaliWorkspaceTemplate({
    fieldRulesOverlay: {},
    canonicalData: { title: "Sample tour" },
  });
  assert.equal(issues.length, 0);
});

test("validateDenaliWorkspaceTemplate rejects tripDetails canonical root with hint", () => {
  const issues = validateDenaliWorkspaceTemplate({
    fieldRulesOverlay: {},
    canonicalData: { tripDetails: { overview: { peakHeight: 5610 } } },
  });
  assert.ok(issues.some((i) => i.path === "canonicalData.tripDetails"));
  assert.ok(issues.some((i) => i.message.includes("overview.peakHeight")));
});

test("validateDenaliWorkspaceTemplate rejects legacy overlay path with storage hint", () => {
  const issues = validateDenaliWorkspaceTemplate({
    fieldRulesOverlay: {
      "tripDetails.overview.peakHeight": { visibility: "always" },
    },
    canonicalData: {},
  });
  assert.ok(
    issues.some(
      (i) =>
        i.path === "fieldRulesOverlay.tripDetails.overview.peakHeight" &&
        i.message.includes("overview.peakHeight"),
    ),
  );
});

test("validateDenaliWorkspaceTemplate rejects pruned ghost overlay paths on save", () => {
  const issues = validateDenaliWorkspaceTemplate({
    fieldRulesOverlay: {
      publishStatus: { visibility: "always" },
      "pricing.paymentMode": { required: "required" },
    },
    canonicalData: {},
  });
  assert.ok(issues.some((i) => i.path === "fieldRulesOverlay.publishStatus"));
  assert.ok(issues.some((i) => i.path === "fieldRulesOverlay.pricing.paymentMode"));
});
