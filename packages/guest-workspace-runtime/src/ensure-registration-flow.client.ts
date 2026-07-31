"use client";

import {
  CatalogRegistrationOtpStep,
  CatalogRegistrationPhoneStep,
  CatalogRegistrationProfileStep,
} from "@app-tour/catalog-registration-flow-ui/react";
import {
  denaliCatalogRegistrationFlowSurface,
  registerDenaliCatalogRegistrationTransportInitializer,
} from "@app-tour/workspace-denali/host/catalog-registration-flow";
import { denaliRegistrationFlowSteps } from "@app-tour/workspace-denali/host/catalog-registration-flow/react";
import { getWorkspacePlugin as getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import { guestClubCatalogRegistrationFlowSurface } from "@app-tour/workspace-guest-club/host/catalog-registration-flow";
import {
  GuestClubDoneStep,
  GuestClubIntakeStep,
} from "@app-tour/workspace-guest-club/host/catalog-registration-flow/react";
import { getWorkspacePlugin as getGuestClubWorkspacePlugin } from "@app-tour/workspace-guest-club/plugin";
import { harborCatalogRegistrationFlowSurface } from "@app-tour/workspace-harbor/host/catalog-registration-flow";
import {
  HarborDoneStep,
  HarborIntakeStep,
} from "@app-tour/workspace-harbor/host/catalog-registration-flow/react";
import { getWorkspacePlugin as getHarborWorkspacePlugin } from "@app-tour/workspace-harbor/plugin";
import { urbanCatalogRegistrationFlowSurface } from "@app-tour/workspace-urban/host/catalog-registration-flow";
import {
  UrbanDoneStep,
  UrbanIntakeStep,
} from "@app-tour/workspace-urban/host/catalog-registration-flow/react";
import { getWorkspacePlugin as getUrbanWorkspacePlugin } from "@app-tour/workspace-urban/plugin";
import {
  registerWorkspaceIntakePlugin,
  registerWorkspaceRegistrationFlowPlugin,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";
import { registerWorkspaceRegistrationFlowSteps } from "@app-tour/workspace-plugin-host/registration-flow";

/**
 * Sync client-layer registration flow + intake ensure.
 *
 * RSC `registerWorkspacePluginSafe` populates the **server** webpack Maps only.
 * `PublicCatalogRegistrationFlow` (`"use client"`) reads the **client** Maps —
 * without this ensure: `REGISTRATION_CLOSED` (missing flow/steps) or
 * `INTAKE_PLUGIN_NOT_REGISTERED` (Denali/Urban intake schema).
 */
const registered = new Set<string>();

function once(pluginId: string, register: () => void): void {
  if (registered.has(pluginId)) {
    return;
  }
  register();
  registered.add(pluginId);
}

function registerIntakeFromPlugin(plugin: WorkspacePlugin): void {
  if (plugin.catalogIntake === undefined) {
    return;
  }
  registerWorkspaceIntakePlugin({
    id: plugin.id,
    catalogIntake: plugin.catalogIntake,
  });
}

export function ensureWorkspaceRegistrationFlowClient(pluginId: string): void {
  switch (pluginId) {
    case "denali":
      once("denali", () => {
        registerIntakeFromPlugin(getDenaliWorkspacePlugin());
        registerDenaliCatalogRegistrationTransportInitializer();
        registerWorkspaceRegistrationFlowPlugin({
          id: "denali",
          catalogRegistrationFlow: denaliCatalogRegistrationFlowSurface,
        });
        registerWorkspaceRegistrationFlowSteps("denali", denaliRegistrationFlowSteps);
      });
      return;
    case "guest-club":
      once("guest-club", () => {
        registerIntakeFromPlugin(getGuestClubWorkspacePlugin());
        registerWorkspaceRegistrationFlowPlugin({
          id: "guest-club",
          catalogRegistrationFlow: guestClubCatalogRegistrationFlowSurface,
        });
        registerWorkspaceRegistrationFlowSteps("guest-club", {
          phone: CatalogRegistrationPhoneStep,
          otp: CatalogRegistrationOtpStep,
          profile: CatalogRegistrationProfileStep,
          intake: GuestClubIntakeStep,
          done: GuestClubDoneStep,
        });
      });
      return;
    case "harbor":
      once("harbor", () => {
        registerIntakeFromPlugin(getHarborWorkspacePlugin());
        registerWorkspaceRegistrationFlowPlugin({
          id: "harbor",
          catalogRegistrationFlow: harborCatalogRegistrationFlowSurface,
        });
        registerWorkspaceRegistrationFlowSteps("harbor", {
          phone: CatalogRegistrationPhoneStep,
          otp: CatalogRegistrationOtpStep,
          profile: CatalogRegistrationProfileStep,
          intake: HarborIntakeStep,
          done: HarborDoneStep,
        });
      });
      return;
    case "urban":
      once("urban", () => {
        registerIntakeFromPlugin(getUrbanWorkspacePlugin());
        registerWorkspaceRegistrationFlowPlugin({
          id: "urban",
          catalogRegistrationFlow: urbanCatalogRegistrationFlowSurface,
        });
        registerWorkspaceRegistrationFlowSteps("urban", {
          phone: CatalogRegistrationPhoneStep,
          otp: CatalogRegistrationOtpStep,
          profile: CatalogRegistrationProfileStep,
          intake: UrbanIntakeStep,
          done: UrbanDoneStep,
        });
      });
      return;
    default:
      return;
  }
}
