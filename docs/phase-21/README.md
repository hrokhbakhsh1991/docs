# Phase 21 — P8 Platform surface hardening

```yaml
phase: 21
pack: P8
pack_version: "1.0"
status: BEHAVIORAL_COMPLETE
ai_agent_pack: COMPLETE
prerequisite: P7 BEHAVIORAL_COMPLETE
sole_entry: AGENT-START.md
boot_manifest: appendices/P8-BOOT-MANIFEST.yaml
strict_scores:
  ingress: 3.5
  session: 2.5
  env: 3.5
  composite: 3.2
exit_target:
  profile_a: "9/10 each axis"
  profile_b: "8/10 session · 8/10 ingress · 9/10 env"
```

> **App fit:** [p8-app-fit.md](p8-app-fit.md) — ~85% P8 به stack مشترک ۴ پروسه می‌خورد؛ بقیه → P9/P10.

## Goal

Profile **A** (dev) + **B** (VPS IP): ingress · session · env **درست و fail-closed** — نه HTTPS production.

## Documents (read order — agents)

| # | File | Role |
| - | ---- | ---- |
| **0** | [AGENT-START.md](AGENT-START.md) | **Sole entry (AI v1.0)** |
| 1 | [appendices/P8-BOOT-MANIFEST.yaml](appendices/P8-BOOT-MANIFEST.yaml) | T0 boot sequence |
| 2 | [p8-app-fit.md](p8-app-fit.md) | Scope fit |
| 3 | [appendices/P8-VERIFICATION-COMMANDS.yaml](appendices/P8-VERIFICATION-COMMANDS.yaml) | 14 nano commands |
| 4 | [appendices/P8-ANTI-HOLLOW-CONTRACT.md](appendices/P8-ANTI-HOLLOW-CONTRACT.md) | No skip / no fake PASS |
| 5 | [DOC-SYNC-INDEX.md](DOC-SYNC-INDEX.md) | Pack index |
| 6 | [p8-exit-checklist.md](p8-exit-checklist.md) | Exit |

## In P8 vs not

| ✅ P8 | ❌ P9/P10 |
| ----- | --------- |
| IP fallback · no silent fallback | guest-surface package |
| cookie **rename** (operator/member) | remove web public-auth |
| JWT↔host · portal middleware | __Host- cookies |
| 4 env bootstrap/verify | TLS · custom apex SSL |

## Effort

🥈 2–4 weeks — [POST-P7-EFFORT-RANKING.md](../POST-P7-EFFORT-RANKING.md)
