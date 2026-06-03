import type { Preview } from "@storybook/react";

import "@app-tour/design-tokens/styles.css";

import { PlatformThemeProvider, WorkspaceThemeProvider } from "@app-tour/theme-react";
import { buildTenantAuthz } from "@app-tour/workspace-sdk/auth";
import {
  STARTER_WORKSPACE_PLUGIN_ID,
  getStarterWorkspacePlugin,
  WORKSPACE_THEME_CSS_VARIABLE,
  getWorkspaceThemePresets,
  type WorkspaceThemePresetId,
} from "@app-tour/workspace-sdk";

const STORYBOOK_TENANT = "storybook-tenant";
const storybookAuthz = buildTenantAuthz({
  userId: "storybook",
  tenantId: STORYBOOK_TENANT,
  role: "admin",
  status: "ACTIVE",
  workspaceId: "storybook-ws",
});

const workspaceAccentToolbarItems: Array<{ value: WorkspaceThemePresetId | ""; title: string }> =
  [
    { value: "", title: "Default" },
    { value: "platform-primary", title: "Platform primary (--color-primary)" },
    { value: "platform-success", title: "Platform success (--color-success)" },
  ];

const preview: Preview = {
  parameters: {
    layout: "centered",
  },
  globalTypes: {
    themeMode: {
      description: "Platform theme mode",
      toolbar: {
        title: "Theme",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
      },
    },
    workspaceAccent: {
      description: `Workspace ${WORKSPACE_THEME_CSS_VARIABLE.colorAccent} preset`,
      toolbar: {
        title: "WS accent",
        items: workspaceAccentToolbarItems,
      },
    },
  },
  initialGlobals: {
    themeMode: "light",
    workspaceAccent: "",
  },
  decorators: [
    (Story, context) => {
      const mode = context.globals.themeMode === "dark" ? "dark" : "light";
      const presetId = context.globals.workspaceAccent as WorkspaceThemePresetId | "";
      const workspaceTheme =
        presetId && presetId.length > 0 ? getWorkspaceThemePresets()[presetId] : undefined;

      return (
        <PlatformThemeProvider mode={mode}>
          <WorkspaceThemeProvider
            plugin={getStarterWorkspacePlugin()}
            theme={workspaceTheme}
            authz={storybookAuthz}
            workspaceThemeAccess={{
              tenantId: STORYBOOK_TENANT,
              workspaceId: "storybook-ws",
              pluginId: STARTER_WORKSPACE_PLUGIN_ID,
            }}
          >
            <div data-storybook-theme-root>
              <Story />
            </div>
          </WorkspaceThemeProvider>
        </PlatformThemeProvider>
      );
    },
  ],
};

export default preview;
