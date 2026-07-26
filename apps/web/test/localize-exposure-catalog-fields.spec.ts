/**
 * Exposure catalog label localization — admin UIs surface wizard copy, not registry English.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { DENALI_WORKSPACE_PLUGIN_ID } from "@app-cloud/workspace-denali";
import { ensureWizardHostAdapterSurface } from "@app-cloud/workspace-denali/host/wizard/host-adapter-surface";
import { getNestedStringValue } from "@app-cloud/workspace-denali/host/ui/adapters/nested-string";
import { loadAppMessages } from "../src/i18n/load-messages";
import { localizeExposureCatalogFields } from "../src/exposure/localize-exposure-catalog-fields";

/**
 * Mirrors next-intl `useTranslations(namespace)` scoping: keys resolve against
 * `messages[namespace]`. Field copy lives under the workspace id namespace (`denali`),
 * not the shell `wizard` chrome namespace.
 */
async function namespacedTranslator(locale: "fa" | "en", namespace: string) {
  const messages = await loadAppMessages(locale);
  const root = messages[namespace] as Record<string, unknown> | undefined;
  return (key: string) => getNestedStringValue(root, key) ?? key;
}

describe("localize-exposure-catalog-fields.spec.ts", () => {
  before(async () => {
    await ensureWizardHostAdapterSurface(DENALI_WORKSPACE_PLUGIN_ID);
  });

  it("WEB-EXP-LOCALIZE-01 replaces registry English adminLabel with denali fa copy", async () => {
    const translate = await namespacedTranslator("fa", "denali");
    const localized = localizeExposureCatalogFields(
      DENALI_WORKSPACE_PLUGIN_ID,
      [
        { id: "title", canonicalPath: "title", adminLabel: "Tour Title", group: "Basics" },
        { id: "denali.destination", canonicalPath: "destinationId", adminLabel: "Destination", group: "Basics" },
        { id: "transport", canonicalPath: "transport.mode", group: "Logistics" },
      ],
      translate,
    );

    assert.equal(localized[0]?.adminLabel, "نام تور");
    assert.equal(localized[1]?.adminLabel, "مقصد");
    assert.equal(localized[2]?.adminLabel, "نحوه حمل‌ونقل");
  });

  it("WEB-EXP-LOCALIZE-02 the shell wizard namespace has no field copy (guards namespace regressions)", async () => {
    const translate = await namespacedTranslator("fa", "wizard");
    const [localized] = localizeExposureCatalogFields(
      DENALI_WORKSPACE_PLUGIN_ID,
      [{ id: "title", canonicalPath: "title", adminLabel: "Tour Title", group: "Basics" }],
      translate,
    );
    assert.notEqual(localized?.adminLabel, "نام تور");
  });

  it("WEB-EXP-LOCALIZE-03 keeps field identity and falls back when no copy exists", async () => {
    const translate = await namespacedTranslator("fa", "denali");
    const [localized] = localizeExposureCatalogFields(
      DENALI_WORKSPACE_PLUGIN_ID,
      [{ id: "unknown", canonicalPath: "totallyUnknownPath", adminLabel: "Original", group: "Misc" }],
      translate,
    );

    assert.equal(localized?.id, "unknown");
    assert.equal(localized?.canonicalPath, "totallyUnknownPath");
    assert.ok((localized?.adminLabel ?? "").length > 0);
  });
});
