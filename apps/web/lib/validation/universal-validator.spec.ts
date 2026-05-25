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
