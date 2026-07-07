# Phase 23 — P10 Platform production grade

```yaml
phase: 23
pack: P10
pack_version: "1.2"
effort: p10-effort-to-nine.md
app_fit: p10-app-fit.md
hardest_pack: true
audit: p10-production-grade-audit.md
strict_scores:
  tls_reverse_proxy: 1.5
  deploy_ci: 4.0
  observability_ops: 3.0
  env_coherence: 3.5
  custom_domain: 5.0
  composite: 3.4
exit_target: "8.7/10 composite (fit-aligned)"
```

> **🥇 بیشترین کار برای ۹–۱۰:** [p10-effort-to-nine.md](p10-effort-to-nine.md) (~5–10 هفته بعد از P8+P9)

## Goal

Profile C HTTPS روی **یک VPS** · CI smoke 4/4 · ops runbook — composite **≥ 8.7**. Profile B IP **نگه داشته می‌شود**.

## Documents (read order)

| # | File | Role |
| - | ---- | ---- |
| 0 | [p10-app-fit.md](p10-app-fit.md) | **آیا P10 به اپ می‌خورد؟** — scope corrections |
| 1 | [p10-effort-to-nine.md](p10-effort-to-nine.md) | Effort · فاصله تا ۹/۱۰ |
| 2 | [p10-production-grade-audit.md](p10-production-grade-audit.md) | Audit سخت + موج A/B/C |
| 3 | [p10-action-plan.yaml](p10-action-plan.yaml) | Machine-readable waves |
| 4 | [p10-gap-registry.md](p10-gap-registry.md) | G-TLS / G-DEP / G-OPS / G-DOM (+ v1.1 new) |
| 5 | [p10-production-profile.yaml](p10-production-profile.yaml) | Profile C contract |
| 6 | [platform-production-grade.mdoc](platform-production-grade.mdoc) | Charter + EPIC |
| 7 | [p10-exit-checklist.md](p10-exit-checklist.md) | Exit strict |

## AI agent pack (v1.0)

| Artifact | Role |
| -------- | ---- |
| [AGENT-START.md](AGENT-START.md) | **Sole entry** — T0 boot |
| [appendices/P10-BOOT-MANIFEST.yaml](appendices/P10-BOOT-MANIFEST.yaml) | 16 nanos · fail_token `P10_FAIL` |
| [appendices/P10-VERIFICATION-COMMANDS.yaml](appendices/P10-VERIFICATION-COMMANDS.yaml) | Per-nano commands |
| [appendices/P10-ANTI-HOLLOW-CONTRACT.md](appendices/P10-ANTI-HOLLOW-CONTRACT.md) | Forbidden shortcuts |
| [DOC-SYNC-INDEX.md](DOC-SYNC-INDEX.md) | Nano map |

Gate: `pnpm run p10:gate` → `P10_PRODUCTION_GRADE_GATE_OK` (chains `p9:gate`)

## Start (when unblocked)

→ [AGENT-START.md](AGENT-START.md) · [../POST-P7-PLATFORM-ROADMAP.md](../POST-P7-PLATFORM-ROADMAP.md)

## EPICs

| EPIC | Focus | Wave |
| ---- | ----- | ---- |
| P10-0 | M+P custom apex · on-demand TLS (Wave C) | B + C |
| P10-1 | Caddy · wildcard staging TLS · loopback | A |
| P10-2 | CI smoke · env · build alignment | A + B |
| P10-3 | Runbooks · rollback · p10:gate | A + B + C |

## P8/P9 dependency

P10 **after** P8 env + cookies + P9 web guest removal. See [p10-action-plan.yaml](p10-action-plan.yaml).

## Out of scope

- Admin custom apex `admin.{apex}` (trunk v2 / H-P6-03)
- Deprecating Profile B IP (P7 delivery)
- k8s Prometheus on VPS (waive)
- SMS provider (waiver / phase-18)
- Payment gateway (phase-18)
