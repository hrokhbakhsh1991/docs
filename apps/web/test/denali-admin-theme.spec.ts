/**
 * Denali operator admin theme — bootstrap + workspace skin contract.
 * @see docs/workspaces/denali/admin-experience.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { resolveBootstrapWorkspacePlugin } from "../src/bootstrap/resolve-bootstrap-workspace-plugin";
import { hydrateBootstrapSession } from "../src/tenant/hydrate-bootstrap-session.client";

const REPO_ROOT = join(import.meta.dirname, "../../..");
const DENALI_THEME_DIR = join(REPO_ROOT, "packages/workspaces/denali/theme");

describe("denali-admin-theme.spec.ts", () => {
  it("WEB-DENALI-THEME-01 resolves denali plugin for bootstrap hydrate", () => {
    const plugin = resolveBootstrapWorkspacePlugin("denali");
    assert.equal(plugin.id, "denali");
    assert.equal(plugin.theme?.optionalStylesheet, "theme/denali-admin.css");
  });

  it("WEB-DENALI-THEME-02 hydrate uses pluginId not starter default", () => {
    const resolved = hydrateBootstrapSession({
      context: {
        userId: "u1",
        tenantId: "00000000-0000-4000-8000-000000000003",
        workspaceId: "ws1",
        role: "owner",
        status: "ACTIVE",
      },
      pluginId: "denali",
    });
    assert.equal(resolved.plugin.id, "denali");
    assert.equal(resolved.session.pluginId, "denali");
  });

  it("WEB-DENALI-THEME-03 urban bootstrap stays isolated from denali plugin", () => {
    const plugin = resolveBootstrapWorkspacePlugin("urban");
    assert.equal(plugin.id, "urban");
    assert.notEqual(plugin.theme?.optionalStylesheet, "theme/denali-admin.css");
  });

  it("WEB-DENALI-THEME-04 admin bundle imports skin + motion layers", () => {
    const bundle = readFileSync(join(DENALI_THEME_DIR, "denali-admin.css"), "utf8");
    for (const file of [
      "admin-skin.css",
      "interactions.css",
      "animations.css",
      "finance-skin.css",
      "wizard-skin.css",
    ]) {
      assert.match(bundle, new RegExp(file.replace(".", "\\.")));
    }
  });

  it("WEB-DENALI-THEME-05 admin skin scopes to body data-workspace-plugin", () => {
    const skin = readFileSync(join(DENALI_THEME_DIR, "admin-skin.css"), "utf8");
    assert.match(skin, /body\[data-workspace-plugin="denali"\]/);
    assert.match(skin, /html\.dark:has\(body\[data-workspace-plugin="denali"\]\)/);
    assert.match(skin, /body\[data-workspace-plugin="denali"\] \.theme-dark/);
    assert.match(skin, /--color-primary:\s*#5eead4/);
  });

  it("WEB-DENALI-THEME-06 interactions wire nav + card surfaces", () => {
    const css = readFileSync(join(DENALI_THEME_DIR, "interactions.css"), "utf8");
    assert.match(css, /\[data-denali-surface="card"\]/);
    assert.match(css, /\[data-operator-nav-link\]/);
    assert.match(css, /\[data-operator-nav-icon\]/);
    assert.match(css, /prefers-reduced-motion: reduce/);
  });

  it("WEB-DENALI-THEME-07 animations fade-up is reduced-motion safe", () => {
    const css = readFileSync(join(DENALI_THEME_DIR, "animations.css"), "utf8");
    assert.match(css, /denali-fade-up/);
    assert.match(css, /\[data-denali-animate="fade-up"\]/);
    assert.match(css, /prefers-reduced-motion: reduce[\s\S]*animation:\s*none/);
  });

  it("WEB-DENALI-THEME-08 admin patterns expose denali skeleton + empty state", () => {
    const skeleton = readFileSync(
      join(import.meta.dirname, "../src/admin/patterns/denali-skeleton.tsx"),
      "utf8"
    );
    const empty = readFileSync(
      join(import.meta.dirname, "../src/admin/patterns/denali-empty-state.tsx"),
      "utf8"
    );
    assert.match(skeleton, /data-denali-skeleton="shimmer"/);
    assert.match(empty, /data-denali-empty-state/);
    const kpiCell = readFileSync(
      join(import.meta.dirname, "../src/admin/patterns/dashboard-kpi-cell.tsx"),
      "utf8"
    );
    assert.match(kpiCell, /data-denali-kpi/);
    assert.match(kpiCell, /line-clamp-2/);
    const skin = readFileSync(join(DENALI_THEME_DIR, "admin-skin.css"), "utf8");
    assert.match(skin, /\[data-denali-empty-state\]/);
    assert.match(skin, /\[data-operator-nav-cta\]/);
  });

  it("WEB-DENALI-THEME-09 bookings + tours denali patterns wired", () => {
    const skin = readFileSync(join(DENALI_THEME_DIR, "admin-skin.css"), "utf8");
    assert.match(skin, /\[data-denali-bookings-inbox\]/);
    assert.match(skin, /\[data-denali-category-badge\]/);
    const timeline = readFileSync(
      join(import.meta.dirname, "../src/admin/patterns/booking-activity-timeline.tsx"),
      "utf8"
    );
    assert.match(timeline, /data-denali-booking-timeline/);
    const categoryBadge = readFileSync(
      join(import.meta.dirname, "../src/admin/patterns/tour-category-badge.tsx"),
      "utf8"
    );
    assert.match(categoryBadge, /data-denali-category-badge/);
  });

  it("WEB-DENALI-THEME-10 operator shell exposes workspace plugin attribute", () => {
    const shell = readFileSync(
      join(import.meta.dirname, "../src/admin/shell/operator-shell.tsx"),
      "utf8"
    );
    assert.match(shell, /data-operator-shell/);
    assert.match(shell, /data-workspace-plugin=\{pluginId\}/);
    assert.match(shell, /data-operator-sidebar/);
    assert.match(shell, /sticky top-14/);
    assert.match(shell, /h-\[calc\(100dvh-3\.5rem\)\]/);
    const nav = readFileSync(
      join(import.meta.dirname, "../src/admin/shell/operator-nav.tsx"),
      "utf8"
    );
    assert.match(nav, /data-operator-sidebar-header/);
    assert.match(nav, /data-operator-sidebar-content/);
    assert.match(nav, /data-operator-sidebar-footer/);
    assert.match(nav, /data-operator-nav-icon/);
    const skin = readFileSync(join(DENALI_THEME_DIR, "admin-skin.css"), "utf8");
    assert.match(skin, /\[data-operator-sidebar\]/);
    assert.match(skin, /\[data-operator-nav-group-label\]/);
    const header = readFileSync(
      join(import.meta.dirname, "../src/admin/shell/operator-header.tsx"),
      "utf8"
    );
    assert.match(header, /backdrop-blur-md/);
    assert.match(header, /data-operator-header/);
    assert.match(header, /data-denali-tenant-badge/);
    assert.match(header, /OperatorBreadcrumb/);
  });

  it("WEB-DENALI-THEME-11 logo mark asset + breadcrumb logic", () => {
    const logo = readFileSync(join(DENALI_THEME_DIR, "assets/logo-mark.svg"), "utf8");
    assert.match(logo, /<svg/);
    const brand = readFileSync(
      join(import.meta.dirname, "../src/admin/shell/operator-brand.tsx"),
      "utf8"
    );
    assert.match(brand, /TenantBrandMark/);
    const interactions = readFileSync(join(DENALI_THEME_DIR, "interactions.css"), "utf8");
    assert.match(interactions, /\[data-operator-header\]\[data-denali-header-scrolled\]/);
  });

  it("WEB-DENALI-THEME-12 finance skin wires alpine KPI + date picker", () => {
    const finance = readFileSync(join(DENALI_THEME_DIR, "finance-skin.css"), "utf8");
    assert.match(finance, /\[data-denali-finance-kpi\]/);
    assert.match(finance, /--denali-alpine-600/);
    const overview = readFileSync(
      join(import.meta.dirname, "../src/finance/finance-overview-panel.tsx"),
      "utf8"
    );
    assert.match(overview, /data-denali-finance-kpi/);
    const picker = readFileSync(
      join(import.meta.dirname, "../src/components/i18n/localized-date-picker.tsx"),
      "utf8"
    );
    assert.match(picker, /data-denali-date-picker/);
  });

  it("WEB-DENALI-THEME-13 root layout exposes data-app-surface admin body contract", () => {
    const layout = readFileSync(join(import.meta.dirname, "../app/layout.tsx"), "utf8");
    assert.match(layout, /data-app-surface="admin"/);
    assert.match(layout, /data-workspace-plugin=\{bootstrap\.pluginId\}/);
  });
});
