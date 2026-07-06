/** CTL-CORE v2 — admin control steps (shared config). */
export const ADMIN_CONTROL_STEPS = [
  {
    name: "admin_shell_r02",
    cmd: ["node", "scripts/guards/guard-admin-shell-r02.mjs"],
    criticalRisk: "R-02",
  },
  {
    name: "admin_shell_i4",
    cmd: ["node", "scripts/guards/guard-admin-shell-i4.mjs"],
    closes: "I4",
  },
  {
    name: "admin_shell_chrome",
    cmd: ["node", "scripts/guards/guard-admin-shell-chrome.mjs"],
    closes: "R-07",
  },
  {
    name: "admin_globals_r03",
    cmd: ["node", "scripts/guards/guard-admin-globals-r03.mjs"],
    criticalRisk: "R-03",
  },
];
