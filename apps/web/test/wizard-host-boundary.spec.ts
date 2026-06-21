/**
 * Phase 12 — generic wizard host must stay plugin-agnostic (WEB-12.1-01, WEB-12.1b-01).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const HOST_PATH = join(import.meta.dirname, "../src/wizard/workspace-wizard-host.tsx");

describe("wizard-host-boundary.spec.ts — Phase 12 host decouple", () => {
  it("WEB-12.1-01 host has no direct Denali review/validation component imports", () => {
    const source = readFileSync(HOST_PATH, "utf8");
    assert.doesNotMatch(source, /from\s+["'].*denali\/denali-review-validation-summary["']/);
    assert.doesNotMatch(source, /DenaliReviewValidationSummary/);
    assert.doesNotMatch(source, /from\s+["'].*denali\/denali-review-step["']/);
    assert.doesNotMatch(source, /from\s+["']@\/i18n\/denali-wizard-labels["']/);
  });

  it("WEB-12.1b-01 host has no pluginId === denali branches", () => {
    const source = readFileSync(HOST_PATH, "utf8");
    assert.doesNotMatch(source, /pluginId\s*===\s*["']denali["']/);
    assert.doesNotMatch(source, /pluginId\s*!==\s*["']denali["']/);
  });

  it("WEB-12-HOST-03 host resolves validation UI via registry helper", () => {
    const source = readFileSync(HOST_PATH, "utf8");
    assert.match(source, /resolveWizardValidationSurface/);
    assert.match(source, /renderValidationSummary/);
  });

  it("WEB-12-HOST-04 host uses resolveInitialStepIndex hook instead of draft resume import", () => {
    const source = readFileSync(HOST_PATH, "utf8");
    assert.match(source, /resolveInitialStepIndex/);
    assert.doesNotMatch(source, /denali-wizard-resume-step/);
  });

  it("WEB-12-HOST-05 validation surface falls back to platform default", () => {
    const registry = readFileSync(
      join(import.meta.dirname, "../src/wizard/wizard-review-surface-registry.tsx"),
      "utf8"
    );
    assert.match(registry, /platform: platformValidationSurface/);
    assert.match(registry, /denaliWizardReviewSurface/);
    assert.match(registry, /resolveWizardValidationSurface[\s\S]*platform/);
  });

  it("WEB-13.6-01 wizard-field has no denali prefix fallback", () => {
    const source = readFileSync(join(import.meta.dirname, "../src/wizard/wizard-field.tsx"), "utf8");
    assert.doesNotMatch(source, /startsWith\(["']denali\./);
  });
});
