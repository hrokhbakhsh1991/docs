/**
 * Build-time workspace theme CSS ingress map.
 * Host loads published package CSS; selectors are scoped (no runtime URL injection).
 */
import "@app-tour/workspace-denali/theme/denali-admin.css";

/** Side-effect import module — import from root layout or AppProviders. */
export function registerWorkspaceThemeStylesheets(): void {
  /* CSS registered at module evaluation time. */
}
