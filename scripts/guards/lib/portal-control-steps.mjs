/** CTL-CORE v2 — portal control steps (shared config). */
export const PORTAL_CONTROL_STEPS = [
  {
    name: "member_shell",
    cmd: ["node", "scripts/guards/guard-member-shell.mjs"],
  },
  {
    name: "portal_member_profile_boundary",
    cmd: ["node", "scripts/guards/guard-portal-member-profile-boundary.mjs"],
  },
  {
    name: "guest_theme_loader",
    cmd: ["node", "scripts/guards/guard-portal-guest-theme-loader.mjs"],
    criticalRisk: "R-01",
  },
  {
    name: "portal_skin_coverage",
    cmd: ["node", "scripts/guards/guard-portal-skin-coverage.mjs"],
    closes: "PTL-8c",
  },
  {
    name: "shell_contract",
    cmd: [
      "pnpm",
      "--filter",
      "@apps/portal",
      "exec",
      "node",
      "--import",
      "tsx",
      "--test",
      "test/portal-member-shell.spec.ts",
    ],
  },
];
