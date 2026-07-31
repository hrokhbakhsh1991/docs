# Harbor production-certification readiness

Harbor is the Denali Gravity **G1 guest-only** certified product-family proof.
Architect YES on OD-5 was recorded on 2026-07-31 and production onboarding is
authorized only for this declared G1 surface.

Authority: [`docs/dev/workspace-certification.mdoc`](../../dev/workspace-certification.mdoc)
and [`docs/architecture/denali-gravity-remediation.mdoc`](../../architecture/denali-gravity-remediation.mdoc).

## Intended promotion

| Property | Decision |
| --- | --- |
| Maturity rung | G1 guest-only |
| Required conformance | L3 or higher |
| `memberApp` | false / omitted |
| Operator, finance, booking | Out of scope for G1 certification |
| Current tier | `certified` |
| Promotion authority | Architect YES on OD-5 — received 2026-07-31 |

## CERT readiness matrix

| Proof | Current evidence | Readiness |
| --- | --- | --- |
| CERT-01 | Registry regenerated: 12 manifests / 67 outputs; freshness guard PASS | Pass |
| CERT-02 | Guest conformance 24/24; operator capabilities explicitly fail closed | Pass |
| CERT-03 | Fresh `SMK-MKT-HARBOR-01` browse/detail/register smoke: 3/3 PASS | Pass |
| CERT-04 | Harbor proof block + certified tier agree with generated registry; certification guard PASS | Pass |
| CERT-05 | This workspace-specific certification/runbook document | Pass |

## Promotion record

Completed after Architect YES:

1. Re-run `SMK-MKT-HARBOR-01` and record fresh evidence.
2. Run registry freshness and guest-conformance guards.
3. Add `plugins.harbor` with CERT-01 through CERT-05 to
   `docs/dev/workspace-certification-proof-matrix.yaml`.
4. Change Harbor `guestConformance.productionTier` from `stub` to `certified`.
5. Regenerate the workspace registry and run `guard:workspace-certification`.
6. Verify production provisioning accepts Harbor while all remaining stubs stay
   fail-closed.

## Certified boundary

Certification covers the G1 guest catalog/detail/registration surface. It does
not claim operator, finance, booking, or Denali G3 parity; `memberApp` remains
omitted and all operator capabilities remain explicitly false.
