import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { DEFAULT_WORKSPACES_DIR, WIZARD_I18N_LOCALES } from "./constants.mjs";

/**
 * next-intl rejects object keys containing "." (flat paths must be nested).
 * @param {unknown} value
 * @param {string} jsonFilePath
 * @param {string} keyPath
 */
export function assertNoDottedKeysInWizardJson(value, jsonFilePath, keyPath = "") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    const fullPath = keyPath.length > 0 ? `${keyPath}.${key}` : key;
    if (key.includes(".")) {
      throw new Error(
        `${jsonFilePath}: key "${fullPath}" contains "." — use nested objects (next-intl INVALID_KEY)`
      );
    }
    assertNoDottedKeysInWizardJson(child, jsonFilePath, fullPath);
  }
}

/**
 * Phase 15.1 P15-W-A1 — wizard i18n assets exist and pass next-intl key rules.
 * @param {import("./manifest-loader.mjs").discoverManifests extends (...args: any) => infer R ? R : never} manifests
 * @param {string} [workspacesDir]
 */
export function assertWizardI18nAssets(manifests, workspacesDir = DEFAULT_WORKSPACES_DIR) {
  for (const manifest of manifests) {
    const namespace = manifest.wizardI18n?.messageNamespace;
    if (typeof namespace !== "string" || namespace.length === 0 || namespace === "wizard") {
      continue;
    }
    const workspaceDir = join(workspacesDir, manifest.id);
    for (const locale of WIZARD_I18N_LOCALES) {
      const jsonPath = join(workspaceDir, "messages", locale, "wizard.json");
      if (!existsSync(jsonPath)) {
        throw new Error(
          `${jsonPath}: missing wizard.json for workspace "${manifest.id}" (wizardI18n.messageNamespace="${namespace}")`
        );
      }
      let parsed;
      try {
        parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${jsonPath}: invalid JSON — ${message}`);
      }
      assertNoDottedKeysInWizardJson(parsed, jsonPath);
    }
  }
}

/**
 * P0 PR-1 — warn on shell `@/` webModule paths; `--strict` fails (PR-5+ target).
 * @param {string} manifestId
 * @param {string} webModule
 * @param {{ strict?: boolean }} options
 */
export function assertPackageWebModule(manifestId, webModule, options = {}) {
  if (typeof webModule !== "string" || webModule.trim().length === 0) {
    throw new Error(`workspace.manifest.json ${manifestId}: webModule must be a non-empty string`);
  }
  if (webModule.startsWith("@app-tour/workspace-")) {
    return;
  }
  const message = `workspace.manifest.json ${manifestId}: webModule "${webModule}" should use @app-tour/workspace-* package export (transitional shell @/ paths deprecated)`;
  if (options.strict === true) {
    throw new Error(message);
  }
  console.warn(`warn: ${message}`);
}

/**
 * @param {import("./manifest-loader.mjs").discoverManifests extends (...args: any) => infer R ? R : never} manifests
 * @param {{ strict?: boolean }} options
 */
export function assertManifestWebModules(manifests, options = {}) {
  for (const m of manifests) {
    const ws = m.wizardSurfaces;
    if (ws?.composite?.webModule !== undefined) {
      assertPackageWebModule(m.id, ws.composite.webModule, options);
    }
    if (ws?.review?.webModule !== undefined) {
      assertPackageWebModule(m.id, ws.review.webModule, options);
    }
    const labelResolver = m.wizardI18n?.labelResolver;
    if (labelResolver?.webModule !== undefined) {
      assertPackageWebModule(m.id, labelResolver.webModule, options);
    }
  }
}
