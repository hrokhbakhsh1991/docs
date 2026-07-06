/** CTL-CORE v2 — platform industrial control steps. */
export const PLATFORM_CONTROL_STEPS = [
  {
    name: "shell_appearance_ast",
    cmd: ["node", "scripts/guards/guard-shell-appearance-ast.mjs"],
    closes: "I0",
  },
  {
    name: "api_lazy_plugin_registry",
    cmd: ["node", "scripts/guards/guard-api-lazy-plugin-registry.mjs"],
    closes: "I5",
  },
  {
    name: "workspace_theme_exports",
    cmd: ["node", "scripts/guards/guard-workspace-theme-exports.mjs"],
    closes: "INV-06b",
  },
  {
    name: "surface_visual_matrix",
    cmd: ["node", "scripts/guards/guard-surface-visual-matrix.mjs"],
    closes: "I6",
  },
  {
    name: "dtcg_tokens",
    cmd: ["node", "scripts/guards/guard-dtcg-tokens.mjs"],
    closes: "R-08",
  },
  {
    name: "dtcg_css_sync",
    cmd: ["node", "scripts/guards/guard-dtcg-css-sync.mjs"],
    closes: "R-08b",
  },
  {
    name: "dtcg_hex_ban",
    cmd: ["node", "scripts/guards/guard-dtcg-hex-ban.mjs"],
    closes: "R-08c",
  },
  {
    name: "skin_specificity",
    cmd: ["node", "scripts/guards/guard-skin-specificity.mjs"],
    closes: "R-10",
  },
];
