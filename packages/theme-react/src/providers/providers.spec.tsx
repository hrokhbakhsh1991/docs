import assert from "node:assert/strict";
import { describe, it } from "node:test";

import React from "react";
import { render } from "@testing-library/react";

import { buildTenantAuthz } from "@app-tour/workspace-sdk/auth";
import { defineAbilityFor } from "@app-tour/workspace-sdk/auth/casl";
import {
  STARTER_WORKSPACE_PLUGIN_ID,
  getStarterWorkspacePlugin,
  WORKSPACE_THEME_CSS_VARIABLE,
  workspaceAccentCssValue,
  getWorkspaceThemePresets,
  type WorkspaceThemeSubject,
} from "@app-tour/workspace-sdk";

import { ThemeProviderChain } from "./ThemeProviderChain";
import { TenantThemeProvider } from "./TenantThemeProvider";
import { WorkspaceThemeProvider } from "./WorkspaceThemeProvider";

const platformPrimaryPreset = getWorkspaceThemePresets()["platform-primary"];
const platformSuccessAccent = workspaceAccentCssValue("platform-success")!;
const TEST_TENANT = "tenant-test";

function testAuthz(tenantId = TEST_TENANT, workspaceId = "ws-test") {
  return buildTenantAuthz({
    userId: "test-user",
    tenantId,
    role: "member",
    status: "ACTIVE",
    workspaceId,
  });
}

function testWorkspaceThemeAccess(
  overrides: Partial<WorkspaceThemeSubject> = {},
): WorkspaceThemeSubject {
  return {
    tenantId: TEST_TENANT,
    workspaceId: "ws-test",
    pluginId: STARTER_WORKSPACE_PLUGIN_ID,
    ...overrides,
  };
}

describe("theme providers", () => {
  it("denies workspace theme DOM when pluginId on access disagrees with plugin prop", () => {
    const { container, getByTestId } = render(
      <WorkspaceThemeProvider
        plugin={getStarterWorkspacePlugin()}
        theme={platformPrimaryPreset}
        authz={testAuthz()}
        workspaceThemeAccess={testWorkspaceThemeAccess({ pluginId: "not-starter" })}
      >
        <span data-testid="plugin-mismatch-child">child</span>
      </WorkspaceThemeProvider>,
    );
    assert.ok(getByTestId("plugin-mismatch-child"));
    assert.equal(container.querySelector("[data-workspace-theme]"), null);
  });

  it("denies workspace theme DOM when optional AppAbility CASL gate fails (§15.3)", () => {
    const ability = defineAbilityFor({
      userId: "test-user",
      tenantId: "tenant-a",
      role: "member",
      status: "ACTIVE",
      workspaceId: "ws-test",
    });
    const { container, getByTestId } = render(
      <WorkspaceThemeProvider
        plugin={getStarterWorkspacePlugin()}
        theme={platformPrimaryPreset}
        authz={testAuthz("tenant-a")}
        ability={ability}
        workspaceThemeAccess={testWorkspaceThemeAccess({ tenantId: "tenant-b" })}
      >
        <span data-testid="casl-deny-child">child</span>
      </WorkspaceThemeProvider>,
    );
    assert.ok(getByTestId("casl-deny-child"));
    assert.equal(container.querySelector("[data-workspace-theme]"), null);
  });

  it("denies workspace theme DOM when tenant authz access fails (cross-tenant)", () => {
    const { container, getByTestId } = render(
      <WorkspaceThemeProvider
        plugin={getStarterWorkspacePlugin()}
        theme={platformPrimaryPreset}
        authz={testAuthz("tenant-a")}
        workspaceThemeAccess={testWorkspaceThemeAccess({ tenantId: "tenant-b" })}
      >
        <span data-testid="cross-tenant-child">child</span>
      </WorkspaceThemeProvider>,
    );
    assert.ok(getByTestId("cross-tenant-child"));
    assert.equal(container.querySelector("[data-workspace-theme]"), null);
  });

  it("ThemeProviderChain fails closed when ability cannot access workspace theme (§8.2 #4)", () => {
    const suspendedAuthz = buildTenantAuthz({
      userId: "test-user",
      tenantId: TEST_TENANT,
      role: "member",
      status: "SUSPENDED",
      workspaceId: "ws-test",
    });
    const { container, getByText } = render(
      <ThemeProviderChain
        mode="light"
        tenantTheme={{}}
        plugin={getStarterWorkspacePlugin()}
        authz={suspendedAuthz}
        workspaceThemeAccess={testWorkspaceThemeAccess()}
        workspaceTheme={platformPrimaryPreset}
      >
        <span>blocked</span>
      </ThemeProviderChain>,
    );
    assert.ok(getByText("blocked"));
    assert.equal(container.querySelector("[data-workspace-theme]"), null);
    assert.equal(
      container.querySelector(`[style*="${WORKSPACE_THEME_CSS_VARIABLE.colorAccent}"]`),
      null,
    );
  });

  it("WorkspaceThemeProvider scopes --ws-* on subtree", () => {
    const { container } = render(
      <WorkspaceThemeProvider
        plugin={getStarterWorkspacePlugin()}
        theme={platformPrimaryPreset}
        authz={testAuthz()}
        workspaceThemeAccess={testWorkspaceThemeAccess()}
      >
        <span data-testid="child">child</span>
      </WorkspaceThemeProvider>,
    );
    const root = container.querySelector(
      `[data-workspace-theme='${platformPrimaryPreset.id}']`,
    ) as HTMLElement;
    assert.equal(
      root.style.getPropertyValue(WORKSPACE_THEME_CSS_VARIABLE.colorAccent),
      workspaceAccentCssValue("platform-primary"),
    );
  });

  it("ThemeProviderChain renders children", () => {
    const { getByText } = render(
      <ThemeProviderChain
        mode="light"
        tenantTheme={{ cssVariables: { "--color-primary": "var(--color-info)" } }}
        plugin={getStarterWorkspacePlugin()}
        authz={testAuthz()}
        workspaceThemeAccess={testWorkspaceThemeAccess()}
        workspaceTheme={{
          id: "chain",
          version: 1,
          cssVariables: {
            [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: platformSuccessAccent,
          },
        }}
      >
        <span>Go</span>
      </ThemeProviderChain>,
    );
    assert.ok(getByText("Go"));
  });

  it("WorkspaceThemeProvider ignores post-validation mutation of theme prop", () => {
    const theme = {
      id: "mut",
      version: 1,
      cssVariables: {
        [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: workspaceAccentCssValue("platform-primary")!,
      },
    };
    const { container, rerender } = render(
      <WorkspaceThemeProvider
        plugin={getStarterWorkspacePlugin()}
        theme={theme}
        authz={testAuthz()}
        workspaceThemeAccess={testWorkspaceThemeAccess()}
      >
        <span>x</span>
      </WorkspaceThemeProvider>,
    );
    const root = container.querySelector("[data-workspace-theme='mut']") as HTMLElement;
    assert.equal(
      root.style.getPropertyValue(WORKSPACE_THEME_CSS_VARIABLE.colorAccent),
      workspaceAccentCssValue("platform-primary"),
    );
    theme.cssVariables[WORKSPACE_THEME_CSS_VARIABLE.colorAccent] = "javascript:alert(1)";
    rerender(
      <WorkspaceThemeProvider
        plugin={getStarterWorkspacePlugin()}
        theme={theme}
        authz={testAuthz()}
        workspaceThemeAccess={testWorkspaceThemeAccess()}
      >
        <span>x</span>
      </WorkspaceThemeProvider>,
    );
    assert.equal(
      root.style.getPropertyValue(WORKSPACE_THEME_CSS_VARIABLE.colorAccent),
      workspaceAccentCssValue("platform-primary"),
    );
  });

  it("rejects unsafe tenant theme before DOM injection", () => {
    assert.throws(() =>
      render(
        <TenantThemeProvider
          theme={{
            cssVariables: { "--color-primary": "url(javascript:alert(1))" },
          }}
        >
          <span>x</span>
        </TenantThemeProvider>,
      ),
    );
  });

  it("TenantThemeProvider omits inline primary when html.dark (F9-4)", () => {
    document.documentElement.classList.add("dark");
    try {
      const { container } = render(
        <TenantThemeProvider
          theme={{
            primaryColor: "#0f766e",
            cssVariables: { "--color-border": "#ccc" },
          }}
        >
          <span>x</span>
        </TenantThemeProvider>,
      );
      const root = container.querySelector("[data-tenant-theme]") as HTMLElement;
      assert.equal(root.style.getPropertyValue("--color-primary"), "");
      assert.equal(root.style.getPropertyValue("--color-border"), "#ccc");
    } finally {
      document.documentElement.classList.remove("dark");
    }
  });

  it("rejects invalid theme via ingress guard", () => {
    assert.throws(() =>
      render(
        <WorkspaceThemeProvider
          plugin={getStarterWorkspacePlugin()}
          authz={testAuthz()}
          workspaceThemeAccess={testWorkspaceThemeAccess()}
          theme={{
            id: "bad",
            version: 1,
            cssVariables: { "--evil": "red" },
          }}
        >
          <span>x</span>
        </WorkspaceThemeProvider>,
      ),
    );
  });

  it("PlatformThemeProvider sets theme class", () => {
    const { container } = render(
      <ThemeProviderChain
        mode="dark"
        tenantTheme={{}}
        plugin={getStarterWorkspacePlugin()}
        authz={testAuthz()}
        workspaceThemeAccess={testWorkspaceThemeAccess()}
      >
        <span>x</span>
      </ThemeProviderChain>,
    );
    assert.ok(container.querySelector(".theme-dark"));
  });
});
