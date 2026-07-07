import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SettingsModuleMetadata } from "@/features/settings/settings-module-types";
import {
  DENALI_BACKEND_REQUIRED_MODULE_IDS,
  guardSettingsModulesAgainstBackend,
} from "@/features/settings/settings-module-consistency-guard";

const integrationsModule: SettingsModuleMetadata = {
  id: "integrations",
  kind: "readonly_explorer",
  route: "settings/integrations",
  ability: "operator.settings.integrations",
  nav: { group: "workspace", labelKey: "settings.integrations" },
};

const brandingModule: SettingsModuleMetadata = {
  id: "workspace_branding",
  kind: "readonly_explorer",
  route: "settings/branding",
  ability: "operator.settings.workspace_branding",
  nav: { group: "workspace", labelKey: "settings.workspace_branding" },
};

function moduleForId(id: string): SettingsModuleMetadata {
  if (id === "integrations") {
    return integrationsModule;
  }
  if (id === "workspace_branding") {
    return brandingModule;
  }
  return {
    id,
    kind: "readonly_explorer",
    route: `settings/${id}`,
    ability: `operator.settings.${id}`,
    nav: { group: "workspace", labelKey: `settings.${id}` },
  };
}

describe("settings-module-consistency-guard", () => {
  it("passes through modules when Denali backend includes manifest-required modules", () => {
    const result = guardSettingsModulesAgainstBackend(
      DENALI_BACKEND_REQUIRED_MODULE_IDS.map(moduleForId),
      "denali"
    );
    assert.equal(result.desyncDetected, false);
    assert.equal(result.modules.length, DENALI_BACKEND_REQUIRED_MODULE_IDS.length);
  });

  it("injects missing integrations from Denali fallback manifest", () => {
    const modules = DENALI_BACKEND_REQUIRED_MODULE_IDS.filter((id) => id !== "integrations").map(
      moduleForId
    );
    const result = guardSettingsModulesAgainstBackend(modules, "denali");
    assert.equal(result.desyncDetected, true);
    assert.deepEqual(result.missingFromBackend, ["integrations"]);
    assert.equal(result.modules.length, DENALI_BACKEND_REQUIRED_MODULE_IDS.length);
    const integrationsIndex = result.modules.findIndex((module) => module.id === "integrations");
    const brandingIndex = result.modules.findIndex((module) => module.id === "workspace_branding");
    const exposureIndex = result.modules.findIndex((module) => module.id === "exposure");
    assert.ok(integrationsIndex > brandingIndex);
    assert.ok(exposureIndex > integrationsIndex);
  });

  it("does not enforce Denali required modules for starter plugin", () => {
    const result = guardSettingsModulesAgainstBackend([brandingModule], "starter");
    assert.equal(result.desyncDetected, false);
    assert.equal(result.modules.length, 1);
  });
});
