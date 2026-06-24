# P7 file map

```yaml
pack_version: "1.6"
nano_total: 27
status: IN_PROGRESS
gate: pnpm run p7:gate
staging_gate: pnpm run p7:staging-gate
boot_manifest: appendices/P7-BOOT-MANIFEST.yaml
navigator: ../AGENT-NAVIGATOR.md
machine_snapshot: AGENT-CURRENT-PHASE.yaml
doc_quality_target: "98+ai"
```

## T0 — AI boot (sole entry)

| # | File | Role |
| - | ---- | ---- |
| 1 | `AGENT-START.md` | Sole human/agent entry |
| 2 | `appendices/P7-BOOT-MANIFEST.yaml` | T0 machine boot |
| 3 | `appendices/IMPLEMENTATION-TRUTH-P7.md` | Truth ledger |
| 4 | `appendices/P7-ANTI-HOLLOW-CONTRACT.md` | Gate honesty |
| 5 | `appendices/P7-VERIFICATION-COMMANDS.yaml` | Canonical verify (27 nanos) |
| 6 | `appendices/P7-AGENT-TURN-SCHEMA.md` | Mandatory turn report |

## T1 — Current nano

| File | Role |
| ---- | ---- |
| `p7-{0..3}-*.md` | EPIC spec nano block |
| Linked runbook | From verification YAML `manual_runbook_ref` |

## T2 — Lookup

| File | Role |
| ---- | ---- |
| `appendices/TRACEABILITY-MATRIX-P7.md` | Human traceability |
| `appendices/P7-TEST-INVENTORY.md` | Spec tier registry |
| `appendices/SMOKE-SCENARIO-MAP-P7.md` | Smoke IDs |
| `p7-exit-checklist.md` | Staging progress |
| `DOC-SYNC-INDEX.md` | Pack progress |

## Deprecated

| File | Role |
| ---- | ---- |
| `AGENT-CONTEXT.md` | Redirect only — P7_FAIL if sole boot |

## Runbooks (operational)

| File | Tier / nano |
| ---- | ----------- |
| `runbooks/p7-0-env-matrix.md` | P7-0-N-002 |
| `runbooks/p7-staging-gate.md` | T1+infra+T3 |
| `runbooks/p7-staging-e2e.md` | T2 |
| `runbooks/p7-staging-e2e-ci.md` | CI remote gate |
| `runbooks/p7-incident-staging.md` | SEV-1..3 |
| `runbooks/p7-wizard-blocker-walkthrough.md` | P7-1-N-001 |
| `runbooks/p7-customer-sign-off.md` | T4 |

## Scripts

| Script | npm |
| ------ | --- |
| `scripts/p7-denali-delivery-gate.sh` | `pnpm run p7:gate` |
| `scripts/p7-staging-verify.sh` | `pnpm run p7:staging-verify` |
| `scripts/p7-staging-gate.sh` | `pnpm run p7:staging-gate` |
| `scripts/p7-evidence-pack-verify.sh` | `pnpm run p7:evidence-pack-verify` |

## EPIC specs

| File | EPIC | Nanos |
| ---- | ---- | ----- |
| `p7-0-live-infra.md` | P7-0 | 5 |
| `p7-1-wizard-completion.md` | P7-1 | 9 |
| `p7-2-workspace-ops.md` | P7-2 | 8 |
| `p7-3-delivery-exit.md` | P7-3 | 5 |
