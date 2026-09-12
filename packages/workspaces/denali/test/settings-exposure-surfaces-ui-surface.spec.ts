import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { IMPORT_UI_SURFACE_LOADERS } from "../src/wizard/import-ui-surface.loaders.ts";
import {
  DENALI_SETTINGS_EXPOSURE_SURFACES_UI_KEYS,
  type DenaliSettingsExposureSurfacesChrome,
  type DenaliSettingsExposureSurfacesIo,
  type DenaliSettingsExposureSurfacesPanelProps,
  type DenaliSettingsExposureSurfacesSelection,
  type DenaliSettingsExposureSurfacesUiSurface,
} from "../src/ui/settings/settings-exposure-surfaces-ui-surface.ts";

const here = dirname(fileURLToPath(import.meta.url));

describe("settings-exposure-surfaces-ui-surface (H1.c.2.b)", () => {
  it("locks WorkspaceSurfacesPanel key and binding surface export", () => {
    assert.ok(
      "../ui/settings/settings-exposure-surfaces-ui-binding" in IMPORT_UI_SURFACE_LOADERS
    );
    assert.deepEqual(Object.keys(DENALI_SETTINGS_EXPOSURE_SURFACES_UI_KEYS), [
      "WorkspaceSurfacesPanel",
    ]);
    const binding = readFileSync(
      join(here, "../src/ui/settings/settings-exposure-surfaces-ui-binding.ts"),
      "utf8",
    );
    assert.match(binding, /export const denaliSettingsExposureSurfacesUiSurface/);
    assert.match(binding, /WorkspaceSurfacesPanel: DenaliWorkspaceSurfacesPanel/);
  });

  it("requires io, chrome, and selection on panel props", () => {
    const io: DenaliSettingsExposureSurfacesIo = {
      loadSurfaces: async () => ({ surfaces: [] }),
      saveSurfaceIntent: async () => undefined,
    };
    const chrome: DenaliSettingsExposureSurfacesChrome = {
      CollapsibleSection: () => null,
      FieldChecklist: () => null,
      Badge: () => null,
      Button: () => null,
      Card: () => null,
      CardHeader: () => null,
      CardTitle: () => null,
      CardDescription: () => null,
      CardContent: () => null,
      Label: () => null,
      Skeleton: () => null,
    };
    const selection: DenaliSettingsExposureSurfacesSelection = {
      catalogFieldIdsFromExposureFields: () => [],
      toExposureChecklistFields: () => [],
      resolveEffectiveSelectedFieldIds: () => [],
      toggleExposureFieldSelection: (state) => state,
      setExposureCustomizeFields: (state) => state,
    };
    const props: DenaliSettingsExposureSurfacesPanelProps = {
      workspaceId: "ws_1",
      exposureCandidateFields: [],
      canEdit: true,
      io,
      chrome,
      selection,
    };
    assert.equal(typeof props.selection.toggleExposureFieldSelection, "function");

    const _surfaceKeys: keyof DenaliSettingsExposureSurfacesUiSurface =
      "WorkspaceSurfacesPanel";
    assert.equal(_surfaceKeys, "WorkspaceSurfacesPanel");
  });
});
