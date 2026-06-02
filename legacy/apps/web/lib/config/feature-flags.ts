function envFlagEnabled(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Leader dashboard data-source switch.
 * Prefer `NEXT_PUBLIC_` variant for client components; non-public variant is
 * also checked to support build-time toggling in some environments.
 */
export function leaderDashboardUseAggregateApi(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_LEADER_DASHBOARD_USE_AGGREGATE_API ??
    process.env.LEADER_DASHBOARD_USE_AGGREGATE_API;
  if (raw !== undefined && raw.trim() !== "") {
    return envFlagEnabled(raw);
  }
  return true;
}

/**
 * Rollout flag for the **unified Tour Domain Profile pathway in the Edit form's Zod
 * resolver** (Phase B convergence in the unified-domain plan;
 * see `docs/20-architecture/unified-tour-domain-model.md`).
 *
 * - **ON (default, since Phase P7 — promptq.md):** the resolver in
 *   `apps/web/src/components/tours/TourForm.tsx` derives its trip-details schema from
 *   `domainProfileFromEditFormValues(...)` whenever a workspace theme catalog is
 *   loaded. In the "catalog overrides tourType" corner case (i.e.
 *   `dualClassificationForEditForm({...}).agrees === false`), the Zod schema matches
 *   the wizard's view of the same row instead of the legacy `EventKind` resolver's.
 *
 * - **Opt-out (kill switch):** set `NEXT_PUBLIC_LEGACY_EDIT_RESOLVER_ENABLED=1` (or the
 *   non-public variant `LEGACY_EDIT_RESOLVER_ENABLED=1`) to force the legacy
 *   `resolveEventKindFromTourContext` path back on for emergency rollback. This kill
 *   switch is retained for one release cycle (Phase P8 will remove it once telemetry
 *   confirms zero `agrees === false` drift in production).
 *
 * The agreement case is byte-identical regardless of flag state (proven by invariant
 * I-6); flipping is observable only for the tiny "disagree" subset. The
 * `unified_edit_resolver_enabled` observability tag reflects whatever this function
 * returns at call time, so dashboards keep the legacy/new attribution.
 */
export function useUnifiedTourDomainProfileForEditResolver(): boolean {
  if (legacyEditResolverKillSwitchEnabled()) {
    return false;
  }
  return true;
}

/**
 * Emergency kill switch: when truthy, forces `useUnifiedTourDomainProfileForEditResolver`
 * back to `false` so the Edit resolver uses the legacy `EventKind` path. Provided as
 * a single-cycle escape hatch after the Phase P7 flag flip.
 */
export function legacyEditResolverKillSwitchEnabled(): boolean {
  return (
    envFlagEnabled(process.env.NEXT_PUBLIC_LEGACY_EDIT_RESOLVER_ENABLED) ||
    envFlagEnabled(process.env.LEGACY_EDIT_RESOLVER_ENABLED)
  );
}

/**
 * Rollout gate for the Denali **subdomain** (`denali.{root}`) 6-tab create rail.
 *
 * - `denali_pilot` form profile and explicit `wizardMode: "denali"` are **not** gated by this flag.
 * - When env is unset: enabled in non-production (local `denali.localhost`), disabled in production until
 *   `NEXT_PUBLIC_DENALI_SIX_TAB_WIZARD=1` is set.
 * - Set to `0` / `false` to force the classic 9-step wizard on the Denali tenant (emergency rollback).
 */
export function denaliSixTabWizardTenantGatingEnabled(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_DENALI_SIX_TAB_WIZARD ?? process.env.DENALI_SIX_TAB_WIZARD;
  if (raw === undefined || raw.trim() === "") {
    return process.env.NODE_ENV !== "production";
  }
  return envFlagEnabled(raw);
}

/** Phase 5 canonical UI: default ON. Set `NEXT_PUBLIC_DENALI_CANONICAL_UI_MODE=0` to rollback. */
export const DENALI_CANONICAL_UI_MODE = true;

/**
 * Phase 5: Denali wizard UI reads/writes via {@link DenaliCanonicalTourModel} context.
 * Default ON — set env to `0` / `false` for emergency rollback to form-derived mirror.
 */
export function denaliCanonicalUiModeEnabled(): boolean {
  const raw =
    process.env.NEXT_PUBLIC_DENALI_CANONICAL_UI_MODE ?? process.env.DENALI_CANONICAL_UI_MODE;
  if (raw === undefined || raw.trim() === "") {
    return DENALI_CANONICAL_UI_MODE;
  }
  return envFlagEnabled(raw);
}

