import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReactNode } from "react";

import React from "react";
import { render } from "@testing-library/react";

import { PlatformThemeProvider, WorkspaceThemeProvider } from "@app-tour/theme-react";

import { buildTenantAuthz } from "@app-tour/workspace-sdk/auth";
import {
  STARTER_WORKSPACE_PLUGIN_ID,
  getStarterWorkspacePlugin,
  WORKSPACE_THEME_CSS_VARIABLE,
  workspaceAccentCssValue,
  getWorkspaceThemePresets,
} from "@app-tour/workspace-sdk";

const visualTestAuthz = buildTenantAuthz({
  userId: "visual-test",
  tenantId: "visual-test-tenant",
  role: "member",
  status: "ACTIVE",
  workspaceId: "visual-ws",
});

const visualTestThemeAccess = {
  tenantId: "visual-test-tenant",
  workspaceId: "visual-ws",
  pluginId: STARTER_WORKSPACE_PLUGIN_ID,
} as const;

import { Button } from "@app-tour/ui-primitives/button";
import { FieldShell } from "@app-tour/ui-primitives/field-shell";
import { Input } from "@app-tour/ui-primitives/input";

const WORKSPACE_ACCENT_PLATFORM_PRIMARY = workspaceAccentCssValue("platform-primary")!;

function ThemeHarness({
  mode,
  workspaceTheme,
  children,
}: {
  mode: "light" | "dark";
  workspaceTheme?: ReturnType<typeof getWorkspaceThemePresets>["platform-primary"];
  children: ReactNode;
}) {
  return (
    <PlatformThemeProvider mode={mode}>
      <WorkspaceThemeProvider
        plugin={getStarterWorkspacePlugin()}
        theme={workspaceTheme}
        authz={visualTestAuthz}
        workspaceThemeAccess={visualTestThemeAccess}
      >
        {children}
      </WorkspaceThemeProvider>
    </PlatformThemeProvider>
  );
}

describe("visual theme atoms", () => {
  it("renders Button in light theme wrapper", () => {
    const { container } = render(
      <ThemeHarness mode="light">
        <Button>Light</Button>
      </ThemeHarness>,
    );
    assert.ok(container.querySelector("button"));
  });

  it("renders Button in dark theme wrapper", () => {
    const { container } = render(
      <ThemeHarness mode="dark">
        <Button>Dark</Button>
      </ThemeHarness>,
    );
    assert.ok(container.querySelector("button"));
  });

  it("renders FieldShell + Input with workspace override", () => {
    const { container } = render(
      <ThemeHarness mode="light" workspaceTheme={getWorkspaceThemePresets()["platform-primary"]}>
        <FieldShell label="Accent field">
          <Input aria-label="accent-input" />
        </FieldShell>
      </ThemeHarness>,
    );
    const workspaceRoot = container.querySelector("[data-workspace-theme]") as HTMLElement;
    assert.ok(workspaceRoot);
    assert.equal(
      workspaceRoot.style.getPropertyValue(WORKSPACE_THEME_CSS_VARIABLE.colorAccent),
      WORKSPACE_ACCENT_PLATFORM_PRIMARY,
    );
    assert.equal(WORKSPACE_ACCENT_PLATFORM_PRIMARY, "var(--color-primary)");
  });

  it("rejects unsafe workspace accent via ingress", () => {
    const unsafeTheme = {
      ...getWorkspaceThemePresets()["platform-primary"],
      cssVariables: {
        [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: "javascript:alert(1)",
      },
    };
    assert.throws(() =>
      render(
        <ThemeHarness mode="light" workspaceTheme={unsafeTheme}>
          <Input aria-label="x" />
        </ThemeHarness>,
      ),
    );
  });

  it("renders secondary variant under dark theme", () => {
    const { container } = render(
      <ThemeHarness mode="dark">
        <Button variant="secondary">Secondary</Button>
      </ThemeHarness>,
    );
    assert.ok(container.querySelector('button[data-variant="secondary"]'));
  });
});
