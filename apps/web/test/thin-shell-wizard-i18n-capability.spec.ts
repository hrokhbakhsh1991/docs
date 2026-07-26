/**
 * Thin Shell Phase 4bh — wizard i18n allowlist-only codegen + dynamic translator.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isWorkspaceWizardI18nNamespace,
  listWorkspaceWizardI18nNamespaces,
} from "../src/bootstrap/wizard-i18n-translator-hooks.generated";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-wizard-i18n — Phase 4bh", () => {
  it("TS-4BH-01 generated hooks are allowlist-only (no useTranslations fan-out)", () => {
    const src = readFileSync(
      resolve(WEB_ROOT, "src/bootstrap/wizard-i18n-translator-hooks.generated.ts"),
      "utf8"
    );
    assert.match(src, /AUTO-GENERATED/);
    assert.doesNotMatch(src, /useTranslations/);
    assert.doesNotMatch(src, /useGeneratedWorkspaceWizardTranslators/);
    assert.doesNotMatch(src, /"use client"/);
    assert.ok(isWorkspaceWizardI18nNamespace("wizard"));
    assert.ok(isWorkspaceWizardI18nNamespace("denali"));
    assert.ok(isWorkspaceWizardI18nNamespace("urban"));
    assert.equal(isWorkspaceWizardI18nNamespace("not-a-ns"), false);
    assert.deepEqual([...listWorkspaceWizardI18nNamespaces()].sort(), [
      "denali",
      "urban",
      "wizard",
    ]);
  });

  it("TS-4BH-02 hand-written translator uses single dynamic useTranslations", () => {
    const src = readFileSync(
      resolve(WEB_ROOT, "src/wizard/use-workspace-wizard-translator.ts"),
      "utf8"
    );
    assert.match(src, /useTranslations\(activeNamespace\)/);
    assert.doesNotMatch(src, /useTranslations\(["']denali["']\)/);
    assert.doesNotMatch(src, /useTranslations\(["']urban["']\)/);
    assert.doesNotMatch(src, /useGeneratedWorkspaceWizardTranslators/);
  });

  it("TS-4BH-03 media route binders remain opaque path tables (plan §2.4)", () => {
    const bff = readFileSync(
      resolve(WEB_ROOT, "src/bootstrap/wizard-media-route-bindings.generated.ts"),
      "utf8"
    );
    const backend = readFileSync(
      resolve(WEB_ROOT, "src/bootstrap/wizard-media-backend-route-bindings.generated.ts"),
      "utf8"
    );
    assert.match(bff, /lookupWizardMediaRouteBffPath/);
    assert.match(backend, /lookupWizardMediaRouteBackendPaths/);
    assert.doesNotMatch(bff, /@app-cloud\/workspace-/);
    assert.doesNotMatch(backend, /@app-cloud\/workspace-/);
    assert.doesNotMatch(bff, /denali|urban|starter/);
    assert.doesNotMatch(backend, /denali|urban|starter/);
  });
});
