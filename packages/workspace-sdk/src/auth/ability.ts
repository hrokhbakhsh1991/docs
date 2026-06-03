/**
 * Central auth entry (Phase 3+).
 *
 * - **Default (theme-react, platform):** pure {@link TenantAuthz} via `buildTenantAuthz` below.
 * - **CASL bridge (apps/api Mongo rules):** `defineAbilityFor` in `./casl/index.ts` — import
 *   `@app-tour/workspace-sdk/auth/casl` or use `createApiAbility` in `apps/api`.
 *
 * **Theme handoff order:** authz/CASL gate → `validateWorkspaceThemeIngress` → sealed DOM
 * (`@app-tour/theme-react` `WorkspaceThemeProvider`).
 */
export {
  buildTenantAuthz,
  canAccessWorkspaceTheme,
  canAccessWorkspaceThemeScoped,
  cannotAccessWorkspaceTheme,
  resolveCanAccessWorkspaceThemeAuthz,
  type CanAccessWorkspaceThemeAuthzParams,
  type TenantAuthz,
} from "./tenant-authz";
