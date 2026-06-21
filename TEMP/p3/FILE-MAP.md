# P3 — File Map (canonical index)

```yaml
doc_id: P3-FILE-MAP
version: 1.2-aligned
updated: 2026-06-21
current_task: —
nano_total: 52
nano_done: 52
```

All P3 docs MUST stay aligned with values in this table. If you change `current_task`, update **every row** in §Sync checklist.

---

## AI pack (read in order)

| # | File | Role |
|---|------|------|
| 1 | [AGENT-START.md](./AGENT-START.md) | **Entry** — current nano + 15 rules |
| 2 | [AGENT-CONTEXT.md](./AGENT-CONTEXT.md) | Frozen facts — no re-explore |
| 3 | [AGENT-MANIFEST.yaml](./AGENT-MANIFEST.yaml) | 52 tasks · deps · files |
| 4 | [AGENT-LOOP.md](./AGENT-LOOP.md) | Session checklist |
| 5 | [p3-denali-safety.md](./p3-denali-safety.md) | Covenant (every PR) |

---

## Epic specs

| EPIC | Nano | Done | Status | Spec | Doc-first |
|------|------|------|--------|------|-----------|
| P3-A | 12 | 12 | complete | [p3-a-workspace-definitions.md](./p3-a-workspace-definitions.md) v1.3 | platform-workspace-definitions.mdoc ✅ 9.9 |
| P3-B | 14 | 14 | complete | [p3-b-generic-widgets.md](./p3-b-generic-widgets.md) v1.3 | platform-generic-widgets.mdoc ✅ 9.9 |
| P3-C | 14 | 14 | complete | [p3-c-workspace-builder.md](./p3-c-workspace-builder.md) v1.3 | platform-workspace-builder.mdoc ✅ 9.9 |
| P3-D | 12 | 12 | complete | [p3-d-migration-parity.md](./p3-d-migration-parity.md) v1.3 | platform-workspace-cutover.mdoc ✅ 9.9 |

---

## Human / phase docs

| File | Role |
|------|------|
| [README.md](./README.md) | Execution index |
| [../p3-metadata-platform.md](../p3-metadata-platform.md) | Short summary alias |
| [../p3-exit-checklist.md](../p3-exit-checklist.md) | Phase exit |
| [../ROADMAP-INDEX.md](../ROADMAP-INDEX.md) | All phases |

---

## §Sync checklist (when advancing a nano)

Update `current_task` + `nano_done` in:

- [x] AGENT-START.md (yaml header + R1 rule line)
- [x] AGENT-MANIFEST.yaml (meta + task status)
- [x] README.md (yaml header)
- [x] FILE-MAP.md (this file — yaml header)
- [x] ../p3-exit-checklist.md
- [x] ../p3-metadata-platform.md
- [x] ../ROADMAP-INDEX.md

---

## Nano math (frozen)

```text
P3-A: 12 + P3-B: 14 + P3-C: 14 + P3-D: 12 = 52 total
```
