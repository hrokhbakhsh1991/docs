/**
 * # `Legacy` namespace — sunset surface for `EventKind`
 *
 * Phase P8 (promptq.md): the `EventKind` axis has been narrowed to a single import
 * namespace. New code MUST classify with `TourFormProfile` / `TourDomainProfile` and
 * enforce via `ProfileRules` (web) + profile strip / invariants (API).
 *
 * **Sanctioned consumers of `Legacy.*`:**
 *
 * - `apps/web/src/features/tours/domain/tourDomainProfileAdapters.ts` — drift telemetry +
 *   the `legacyEventKindFromEditFormValues` helper (retained one cycle past P7 for the
 *   `LEGACY_EDIT_RESOLVER_ENABLED` kill switch).
 * - `apps/web/src/features/tours/observability/tourProfileObservability.ts` — telemetry
 *   strings (`legacy_event_kind` / `projected_event_kind`).
 * - `apps/web/src/components/tours/TourForm.tsx` — passes the telemetry payload through.
 * - `apps/web/src/features/tours/components/tour-create-trip-details-fields.tsx` — the
 *   legacy flat widget (slated for removal once Edit fully migrates off this widget).
 *
 * Every other import site is enforced as a forbidden import via ESLint
 * (`apps/web/.eslintrc.json`) and the architecture-fitness CI script
 * (`scripts/check-tour-domain-guardrails.mjs` + `apps/api/.../fitness.spec.ts`).
 *
 * **Package root:** `@repo/types` no longer re-exports `EventKind` at the top level — use
 * `import { Legacy } from "@repo/types"` exclusively.
 */
export type { EventKind, EventKindResolverInput } from "../tour-kind";
export { resolveEventKindFromTourContext } from "../tour-kind";
export { eventKindForDomainProfile } from "../tour-domain-profile-bridge";
