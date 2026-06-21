# P4 — AI Agent Entry (READ THIS FIRST)

```yaml
doc_id: P4-AGENT-START
version: 1.0-aligned
mandatory: true
current_task: P4-complete
current_epic: —
next_task: —
nano_total: 48
nano_done: 48
file_map: TEMP/p4/FILE-MAP.md
status: complete
verified: 2026-06-21
```

## 15 rules

| #   | Rule                                          |
| --- | --------------------------------------------- |
| R1  | One nano only — **phase complete**            |
| R2  | Read: START → CONTEXT → MANIFEST → epic spec  |
| R3  | Manifest files only                           |
| R4  | IMPLEMENT before TEST                         |
| R5  | Facts frozen — no re-explore                  |
| R6  | `git diff --quiet packages/workspaces/denali` |
| R7  | min 2 assert — no `assert.ok(true)`           |
| R8  | Doc-first for api/marketing/portal            |
| R9  | VERIFY red → STOP                             |
| R10 | Revalidate fail-open (no TX rollback)         |
| R11 | Portal-primary — web redirect only            |
| R12 | No denali/ui in src/platform                  |
| R13 | `guard:public-catalog-m17` in verify          |
| R14 | No heavy gates without YES                    |
| R15 | Update FILE-MAP after each nano               |

## EPIC map

| EPIC | Nano | Status   | Spec                        |
| ---- | ---- | -------- | --------------------------- |
| P4-A | 12   | complete | p4-a-catalog-publish.md     |
| P4-B | 14   | complete | p4-b-portal-registration.md |
| P4-C | 12   | complete | p4-c-club-surfaces.md       |
| P4-D | 10   | complete | p4-d-product-e2e.md         |

Order: **P4-A → P4-B → P4-C → P4-D** — all done.

## VERIFY (phase exit)

```bash
pnpm run p4:gate
```

Optional E2E (Architect YES): `pnpm run p4:e2e-gate`
