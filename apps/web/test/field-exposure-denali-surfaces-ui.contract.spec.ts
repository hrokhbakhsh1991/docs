import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Denali workspace surfaces UI contract", () => {
  it("renders WorkspaceSurfacesPanel via capability registry on exposure settings", () => {
    const client = readFileSync(
      join(repoRoot, "apps/web/app/(app)/settings/exposure/exposure-settings-client.tsx"),
      "utf8",
    );
    assert.match(client, /ensureSettingsExposureSurfacesUiSurface/);
    assert.match(client, /WorkspaceSurfacesPanel/);
    assert.match(client, /operatorCapabilitySupportsFieldExposureSurfaces/);
    assert.doesNotMatch(client, /workspaceType === "denali"/);
    assert.doesNotMatch(client, /DenaliWorkspaceSurfacesPanel/);
  });

  it("locks H1.d exposure-surfaces UI via capability registry + package surface", () => {
    const types = readFileSync(
      join(
        repoRoot,
        "apps/web/src/features/settings/settings-exposure-surfaces-ui-types.ts",
      ),
      "utf8",
    );
    const registry = readFileSync(
      join(
        repoRoot,
        "apps/web/src/features/settings/settings-exposure-surfaces-ui-registry.ts",
      ),
      "utf8",
    );
    const packageWarm = readFileSync(
      join(
        repoRoot,
        "packages/workspaces/denali/src/settings/settings-exposure-surfaces-ui-package-surface.ts",
      ),
      "utf8",
    );
    const packagePanel = readFileSync(
      join(
        repoRoot,
        "packages/workspaces/denali/src/ui/settings/denali-workspace-surfaces-panel.tsx",
      ),
      "utf8",
    );
    const packageBinding = readFileSync(
      join(
        repoRoot,
        "packages/workspaces/denali/src/ui/settings/settings-exposure-surfaces-ui-binding.ts",
      ),
      "utf8",
    );
    const packageTypes = readFileSync(
      join(
        repoRoot,
        "packages/workspaces/denali/src/ui/settings/settings-exposure-surfaces-ui-surface.ts",
      ),
      "utf8",
    );
    const webIo = readFileSync(
      join(repoRoot, "apps/web/src/exposure/web-settings-exposure-surfaces-io.ts"),
      "utf8",
    );
    const webChrome = readFileSync(
      join(repoRoot, "apps/web/src/exposure/web-settings-exposure-surfaces-chrome.tsx"),
      "utf8",
    );
    const webSelection = readFileSync(
      join(repoRoot, "apps/web/src/exposure/web-settings-exposure-surfaces-selection.ts"),
      "utf8",
    );
    const client = readFileSync(
      join(repoRoot, "apps/web/app/(app)/settings/exposure/exposure-settings-client.tsx"),
      "utf8",
    );
    const manifest = readFileSync(
      join(repoRoot, "packages/workspaces/denali/workspace.manifest.json"),
      "utf8",
    );
    assert.match(types, /SettingsExposureSurfacesUiSurface/);
    assert.match(types, /SettingsExposureSurfacesSelection/);
    assert.match(registry, /ensureSettingsExposureSurfacesUiSurface/);
    assert.match(registry, /resolveSettingsExposureSurfacesUiSurface/);
    assert.match(registry, /resolveSettingsExposureSurfacesUiCapability/);
    assert.match(registry, /app-cloud\.settingsExposureSurfacesUiSurface/);
    assert.doesNotMatch(registry, /workspace-settings-exposure-surfaces-ui-bindings/);
    assert.match(packageWarm, /ensureSettingsExposureSurfacesUiPackageSurface/);
    assert.match(packageWarm, /const specifier = "/);
    assert.doesNotMatch(packageWarm, /from \"\.\.\/ui\/settings\/settings-exposure-surfaces-ui-binding\"/);
    assert.match(packagePanel, /selection\.toggleExposureFieldSelection/);
    assert.match(packagePanel, /io\.loadSurfaces/);
    assert.doesNotMatch(packagePanel, /from "@\//);
    assert.match(packageBinding, /denaliSettingsExposureSurfacesUiSurface/);
    assert.match(packageTypes, /DenaliSettingsExposureSurfacesSelection/);
    assert.match(webIo, /webSettingsExposureSurfacesIo/);
    assert.match(webChrome, /webSettingsExposureSurfacesChrome/);
    assert.match(webSelection, /webSettingsExposureSurfacesSelection/);
    assert.match(client, /settings-exposure-surfaces-ui-registry/);
    assert.match(client, /webSettingsExposureSurfacesIo/);
    assert.match(client, /webSettingsExposureSurfacesChrome/);
    assert.match(client, /webSettingsExposureSurfacesSelection/);
    assert.doesNotMatch(client, /workspace-settings-exposure-surfaces-ui-bindings/);
    assert.match(manifest, /settingsExposureSurfacesUi/);
  });

  it("proxies workspace surface exposure routes through the web BFF", () => {
    const listRoute = readFileSync(
      join(repoRoot, "apps/web/app/api/workspaces/[workspaceId]/exposure/surfaces/route.ts"),
      "utf8",
    );
    const patchRoute = readFileSync(
      join(
        repoRoot,
        "apps/web/app/api/workspaces/[workspaceId]/exposure/surfaces/[surfaceKey]/route.ts",
      ),
      "utf8",
    );
    assert.match(listRoute, /\/exposure\/surfaces/);
    assert.match(patchRoute, /proxyIntegrationsApiPatch/);
  });

  it("uses generic ExposureFieldChecklist without Telegram-specific assumptions", () => {
    const packagePanel = readFileSync(
      join(
        repoRoot,
        "packages/workspaces/denali/src/ui/settings/denali-workspace-surfaces-panel.tsx",
      ),
      "utf8",
    );
    const chrome = readFileSync(
      join(repoRoot, "apps/web/src/exposure/web-settings-exposure-surfaces-chrome.tsx"),
      "utf8",
    );
    assert.match(chrome, /ExposureFieldChecklist/);
    assert.match(packagePanel, /FieldChecklist/);
    assert.match(packagePanel, /resolveDenaliOperatorSurfaceDisplayText/);
    assert.match(packagePanel, /settings\.exposure\.fieldChecklist/);
    assert.doesNotMatch(packagePanel, /telegram/i);
  });

  it("keeps Telegram message editing operator-readable on exposure settings", () => {
    const panel = readFileSync(
      join(
        repoRoot,
        "apps/web/app/(app)/settings/integrations/integration-event-delivery-policy-panel.tsx",
      ),
      "utf8",
    );
    const templateSync = readFileSync(
      join(repoRoot, "apps/web/src/exposure/telegram-delivery-template-sync.ts"),
      "utf8",
    );

    assert.match(panel, /TelegramMessagePreview/);
    assert.match(panel, /previewTitle/);
    assert.match(panel, /telegram-delivery-template-sync/);
    assert.match(panel, /syncTelegramTemplateOnFieldToggle/);
    assert.match(panel, /integration-delivery-policy-message-template/);
    assert.match(panel, /renderTelegramDeliveryPreview/);
    assert.doesNotMatch(panel, /insertFieldLabel/);
    assert.doesNotMatch(panel, /integration-delivery-policy-insert-field/);
    assert.match(templateSync, /buildTelegramFieldTemplateLine/);
    assert.doesNotMatch(panel, /TelegramFieldOrderSection/);
    assert.doesNotMatch(panel, /fieldOrderIconInput/);
    assert.doesNotMatch(panel, /AdvancedExposureDiagnostics/);
    assert.doesNotMatch(panel, /advancedSummary/);
    assert.doesNotMatch(panel, /ExposureEnginePreviewPanel/);
    assert.match(panel, /settings\.exposure\.fieldChecklist/);
  });

  it("keeps field exposure editing owned by settings/exposure, not settings/integrations", () => {
    const integrationsClient = readFileSync(
      join(repoRoot, "apps/web/app/(app)/settings/integrations/integrations-settings-client.tsx"),
      "utf8",
    );
    const exposureClient = readFileSync(
      join(repoRoot, "apps/web/app/(app)/settings/exposure/exposure-settings-client.tsx"),
      "utf8",
    );

    assert.doesNotMatch(integrationsClient, /IntegrationEventDeliveryPolicyPanel/);
    assert.match(integrationsClient, /openExposureSettings/);
    assert.match(integrationsClient, /\/settings\/exposure/);
    assert.match(exposureClient, /IntegrationEventDeliveryPolicyPanel/);
  });
});
