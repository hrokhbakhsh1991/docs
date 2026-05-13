/**
 * Env-var feature flags for the tours module. Mirrors the lightweight pattern in
 * `apps/web/lib/config/feature-flags.ts`: each flag is one boolean function that
 * reads `process.env` directly and returns the activation state.
 *
 * Keep this module tiny — flags here exist for **rollout / rollback** of specific
 * behavior shifts from the unified-domain plan (see
 * `docs/20-architecture/unified-tour-domain-model.md`). New profile rules, strip
 * tables, etc. do NOT belong here; they belong in `@repo/types` next to the
 * canonical `TourDomainProfile` definitions.
 */

function envFlagEnabled(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Rollout flag for the **PATCH-time `formProfileSnapshot` refresh** (Phase B S-1 in
 * the unified-domain plan).
 *
 * - **OFF (default):** `ToursService.applyTourFormProfileStripToPersistedTripDetails`
 *   leaves `tours.form_profile_snapshot` untouched on PATCH. This is the pre-rollout
 *   behavior — the snapshot is only written at create-time and can drift if a tour's
 *   theme / `tourType` is edited later.
 *
 * - **ON:** the same helper writes the freshly-resolved profile back to the column
 *   after each strip pass, so the snapshot always reflects which strip rules apply
 *   to the row.
 *
 * Default OFF matches the rollout principle "safe = old behavior" until an operator
 * explicitly opts each environment in. The flag is read on every PATCH (no caching),
 * so a config change takes effect after a redeploy / pod restart, no migration.
 *
 * Env var (case-insensitive): `TOURS_REFRESH_FORM_PROFILE_SNAPSHOT_ON_PATCH=1`.
 */
export function shouldRefreshFormProfileSnapshotOnPatch(): boolean {
  return envFlagEnabled(process.env.TOURS_REFRESH_FORM_PROFILE_SNAPSHOT_ON_PATCH);
}
