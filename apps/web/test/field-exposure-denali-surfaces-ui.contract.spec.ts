import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("Denali workspace surfaces UI contract", () => {
  it("renders DenaliWorkspaceSurfacesPanel on exposure settings for denali workspaces", () => {
    const client = readFileSync(
      join(repoRoot, "apps/web/app/(app)/settings/exposure/exposure-settings-client.tsx"),
      "utf8",
    );
    assert.match(client, /DenaliWorkspaceSurfacesPanel/);
    assert.match(client, /catalog\?\.workspaceType === "denali"/);
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
    const panel = readFileSync(
      join(repoRoot, "apps/web/src/exposure/DenaliWorkspaceSurfacesPanel.tsx"),
      "utf8",
    );
    assert.match(panel, /ExposureFieldChecklist/);
    assert.match(panel, /surfaceDescriptions/);
    assert.match(panel, /EXPOSURE_FIELD_CHECKLIST_TEST_IDS\.search|fieldChecklist/);
    assert.match(panel, /settings\.exposure\.fieldChecklist/);
    assert.doesNotMatch(panel, /telegram/i);
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
