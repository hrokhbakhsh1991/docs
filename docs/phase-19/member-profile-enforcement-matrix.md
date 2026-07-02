# Member Profile — Closed-Loop Enforcement Matrix (M8)

Authority: [`platform-portal-member-profile.mdoc`](./platform-portal-member-profile.mdoc) · runtime module `member-profile-runtime-truth.server.ts` · CI `architecture-truth-guard.mjs`

## Enforcement triangle

| Layer | Mechanism | Default | Strict |
| ----- | --------- | ------- | ------ |
| **CI** | `architecture-truth-guard.mjs` + semantic drift simulation | FAIL on HIGH drift | same |
| **Build** | `guard-portal-member-profile-boundary.mjs` | FAIL on boundary violation | same |
| **Runtime** | `enforceMemberProfileRuntimeTruth` on `/api/me/profile` | WARN + continue | REJECT request |

## Runtime modes

| Mode | Env | Behavior |
| ---- | --- | -------- |
| **warn** | unset or `MEMBER_PROFILE_ENFORCEMENT_MODE=warn` | Log structured WARNING; return success payload |
| **strict** | `MEMBER_PROFILE_ENFORCEMENT_MODE=strict` | Log structured ERROR; return `500` with `PROFILE_ARCHITECTURE_DRIFT_DETECTED` |

Kill-switch: set `MEMBER_PROFILE_ENFORCEMENT_MODE=warn` (or unset) — immediate return to observer-only runtime behavior without redeploying guards.

## Drift types (runtime)

| driftType | Trigger | strict response |
| --------- | ------- | ---------------- |
| `contract_version_mismatch` | Response `contractVersion` ≠ snapshot `v1` | `PROFILE_ARCHITECTURE_DRIFT_DETECTED` |
| `snapshot_sdk_mismatch` | Snapshot field ids ≠ SDK union | `PROFILE_ARCHITECTURE_DRIFT_DETECTED` |
| `sdk_bff_mapping_mismatch` | SDK/BFF reader keys diverge or exposed field lacks reader | `PROFILE_ARCHITECTURE_DRIFT_DETECTED` |
| `identity_exposure_mismatch` | Response `profile.fields` keys ≠ capability exposed set | `PROFILE_ARCHITECTURE_DRIFT_DETECTED` |
| `runtime_truth_cache_store` | Cache store not wired (startup only) | WARN only |

## Failure scenarios

| Scenario | CI | Runtime warn | Runtime strict |
| -------- | -- | ------------ | -------------- |
| New SDK field without BFF reader | FAIL (HIGH) | WARN on first request | REJECT |
| BFF returns extra field not in capabilities | FAIL (semantic HIGH) | WARN | REJECT |
| Snapshot not updated after field add | FAIL (HIGH) | WARN | REJECT |
| Capability field not rendered in UI | FAIL (MEDIUM) | — | — |
| Doc claims stale architecture | FAIL (HIGH) | — | — |
| Legacy `session-profile` reintroduced | FAIL (boundary) | — | — |

## Observability (PII-free)

All M8 enforcement logs include:

- `enforcementMode` — `warn` \| `strict`
- `contractVersion` — e.g. `v1`
- `driftType` — when drift detected
- `traceId` — request correlation

Never logged: field values, nationalId, email, names, tokens.

## Safe rollout strategy

1. **Phase A — CI only (default today):** Guards green; runtime stays `warn`.
2. **Phase B — staging strict:** Set `MEMBER_PROFILE_ENFORCEMENT_MODE=strict` on portal staging; monitor `PROFILE_ARCHITECTURE_DRIFT_DETECTED` rate.
3. **Phase C — production strict:** Enable strict only after 7d zero drift in staging.
4. **Phase D — kill-switch:** Revert env to `warn` if false positives appear; fix root cause; re-enable strict.

## Rollback strategy

| Action | Effect | Reversible |
| ------ | ------ | ---------- |
| Unset / `warn` enforcement mode | Runtime stops rejecting | Immediate |
| Revert portal deploy with M8 route hook | Removes per-request enforcement | Deploy rollback |
| Disable `guard:architecture-truth` in CI | Stops doc/semantic blocking | Not recommended — use fix-forward |
| Restore prior snapshot version | Requires coordinated SDK/BFF/doc migration | Explicit contract bump only |

## Bypass policy

No supported bypass path exists for:

- Direct `identity/me` outside `/api/me/profile` (boundary guard)
- Profile mutations outside `/api/me/profile` (boundary guard)
- HIGH semantic or contract drift in CI (architecture-truth-guard)

Runtime strict mode is the only optional enforcement tier; default remains non-breaking.
