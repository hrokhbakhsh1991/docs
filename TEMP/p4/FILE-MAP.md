# P4 — File Map

```yaml
doc_id: P4-FILE-MAP
version: 1.0-aligned
updated: 2026-06-21
current_task: P4-complete
nano_total: 48
nano_done: 48
status: complete
```

## AI pack

| #   | File                | Role     |
| --- | ------------------- | -------- |
| 1   | AGENT-START.md      | Entry    |
| 2   | AGENT-CONTEXT.md    | Facts    |
| 3   | AGENT-MANIFEST.yaml | Tasks    |
| 4   | AGENT-LOOP.md       | Loop     |
| 5   | p4-denali-safety.md | Covenant |

## Umbrella

| Doc                                               | Role                                          |
| ------------------------------------------------- | --------------------------------------------- |
| docs/phase-17/platform-club-product-surfaces.mdoc | Index + truth table + dependency graph ✅ 9.9 |

## Epic specs

| EPIC | Nano | Spec lines | Doc                                       |
| ---- | ---- | ---------- | ----------------------------------------- |
| P4-A | 12   | ~140       | platform-club-catalog-publish.mdoc ✅ 9.9 |
| P4-B | 14   | ~294       | platform-portal-registration.mdoc ✅ 9.9  |
| P4-C | 12   | ~250       | platform-club-surfaces-config.mdoc ✅ 9.9 |
| P4-D | 10   | ~225       | platform-club-product-e2e.mdoc ✅ 9.9     |

## P4-B baseline (N-001)

- `guard-public-catalog-m17` — 30/30 PASS (2026-06-21)

## Sync checklist

- [x] AGENT-MANIFEST.yaml (nano_done: 48)
- [x] p4-b/c/d nano specs expanded
- [x] phase-17 mdoc RR-04 + gate tsx sync
- [x] public-catalog.md M11 → phase-17 cross-ref
- [x] AGENT-START.md (current_task: P4-complete)
- [x] AGENT-CONTEXT.md (truth table synced)
- [x] ../ROADMAP-INDEX.md
- [x] ../p4-club-product-surfaces.md
- [x] ../p4-exit-checklist.md
