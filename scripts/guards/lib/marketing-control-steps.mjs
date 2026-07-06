/** CTL-CORE v2 — marketing control steps (shared config). */
export const MARKETING_CONTROL_STEPS = [
  {
    name: "control_plane_active",
    cmd: ["node", "scripts/guards/guard-control-plane-r05.mjs"],
    criticalRisk: "R-05",
  },
  {
    name: "marketing_dead_hero_3d",
    cmd: ["node", "scripts/guards/guard-marketing-dead-hero-3d.mjs"],
    closes: "MKT-0",
  },
  {
    name: "marketing_critical_r04",
    cmd: ["node", "scripts/guards/guard-marketing-critical-risks.mjs"],
    criticalRisk: "R-04",
  },
  {
    name: "marketing_landmark",
    cmd: ["node", "scripts/guards/guard-marketing-landmark.mjs"],
    closes: "MKT-8",
  },
  {
    name: "marketing_fallback_shell",
    cmd: ["node", "scripts/guards/guard-marketing-fallback-shell.mjs"],
    closes: "MKT-21",
  },
  {
    name: "marketing_page_icons",
    cmd: ["node", "scripts/guards/guard-marketing-page-icons.mjs"],
    closes: "MKT-13b",
  },
  {
    name: "marketing_locale",
    cmd: ["node", "scripts/guards/guard-marketing-locale.mjs"],
    closes: "MKT-14",
  },
  {
    name: "marketing_nav_manifest",
    cmd: ["node", "scripts/guards/guard-marketing-nav-manifest.mjs"],
    closes: "MKT-22",
  },
  {
    name: "marketing_primitives",
    cmd: ["node", "scripts/guards/guard-marketing-primitives.mjs"],
    closes: "MKT-16",
  },
  {
    name:     "guest_theme_loader",
    cmd: ["node", "scripts/guards/guard-marketing-guest-theme-loader.mjs"],
    closes: "INV-06",
  },
  {
    name: "marketing_skin_coverage",
    cmd: ["node", "scripts/guards/guard-marketing-skin-coverage.mjs"],
    closes: "MKT-15d",
  },
  {
    name: "marketing_skin_import_integrity",
    cmd: ["node", "scripts/guards/guard-marketing-skin-import-integrity.mjs"],
    closes: "R-06",
  },
  {
    name: "denali_boundary",
    cmd: ["node", "scripts/guards/guard-marketing-denali-boundary.mjs"],
    closes: "INV-07",
  },
  {
    name: "skin_size",
    cmd: ["node", "scripts/guards/guard-marketing-skin-size.mjs"],
    closes: "INV-08",
  },
  {
    name: "public_catalog_m17",
    cmd: ["node", "scripts/guards/guard-public-catalog-m17.mjs"],
  },
  {
    name: "shell_contract",
    cmd: [
      "pnpm",
      "--filter",
      "@apps/marketing",
      "exec",
      "node",
      "--import",
      "tsx",
      "--test",
      "test/marketing-shell-contract.spec.ts",
    ],
    closes: "INV-01",
  },
];
