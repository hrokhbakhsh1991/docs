# Harbor production-certification readiness

Harbor is the Denali Gravity **G1 guest-only** product-family proof vehicle.
Under **PSR-6 option A**, Harbor remains **`stub`** until durable proofs are
live-ratified on a release SHA and CERT rows are rebound.

Authority: [`docs/dev/workspace-certification.mdoc`](../../dev/workspace-certification.mdoc),
[`docs/architecture/denali-gravity-remediation.mdoc`](../../architecture/denali-gravity-remediation.mdoc),
and [`docs/architecture/platform-simplification-remediation.mdoc`](../../architecture/platform-simplification-remediation.mdoc) (PSR-6).

## Current maturity (after PSR-6c4 / inventory PSR-6c5)

| Property | Decision |
| --- | --- |
| Maturity rung | G1 guest-only (target) |
| Required conformance | L3 or higher (when recertifying) |
| `memberApp` | false / omitted |
| Operator, finance, booking | Out of scope for G1 certification |
| **Current tier** | **`stub`** (not production-onboardable) |
| Code path | Durable list/detail/register when API host configured and seed env off |
| Seed path | `HARBOR_SMOKE_E2E_SEED=1` remains for e2e fixture only |
| Live durable E2E | **Not yet** — default `test:smoke:harbor` still seed=1; durable harness = `test:smoke:harbor:durable` (PSR-6c6b; needs YES) |

## Historical CERT pack (pre-demote; not production authority)

| Proof | Evidence at DG-5.1 / OD-5 | Historical readiness |
| --- | --- | --- |
| CERT-01 | Registry regenerated; freshness guard PASS | Pass (historical) |
| CERT-02 | Guest conformance; operator capabilities fail closed | Pass (historical) |
| CERT-03 | `SMK-MKT-HARBOR-01` seed/smoke 3/3 | Pass (historical; **seed path**) |
| CERT-04 | Proof block agreed at promote time | Pass (historical) |
| CERT-05 | This runbook | Pass (historical) |

Proof-matrix rows for Harbor remain **removed** until durable live pack + promote.

## Recert checklist (PSR-6c5 recipe — Architect YES for live)

See [`psr-6c5-harbor-durable-proofs-recert.mdoc`](../../audits/snapshots/2026-07-31/psr-6c5-harbor-durable-proofs-recert.mdoc).

1. Durable E2E with seed **off** and real published tours (not memory fixture).
2. Restart durability + tenant RLS (+ optional PSR-5i same-SHA pack).
3. Restore `plugins.harbor` CERT-01…05 in the proof matrix (CERT-03 hooks must
   target durable evidence).
4. Set `guestConformance.productionTier: certified`.
5. Regenerate registry; `pnpm run guard:workspace-certification`.
6. Architect promote YES.

## Certified boundary (when re-promoted)

Certification will cover only the G1 guest catalog/detail/registration surface
after durable persistence and default non-501 production behavior are proven.
It will not claim operator, finance, booking, or Denali G3 parity.
