# P3 — Agent Session Loop (repeat every nano)

```yaml
doc_id: P3-AGENT-LOOP
version: 1.2-aligned
current_task: P3-A-N-011
file_map: TEMP/p3/FILE-MAP.md
use: paste at start of each AI session working on P3
```

---

## Session checklist (copy-paste for AI)

```text
[ ] 1. Read AGENT-START.md → note current_task id
[ ] 2. Read AGENT-CONTEXT.md (skip codebase exploration)
[ ] 3. Open AGENT-MANIFEST.yaml → confirm deps of current_task are done
[ ] 4. Open epic spec → find ### {current_task} section
[ ] 5. Confirm files ONLY from §File manifest / manifest.yaml edit/create lists
[ ] 6. IMPLEMENT or TEST per nano type
[ ] 7. Run VERIFY block from spec (all green)
[ ] 8. git diff packages/workspaces/denali → must be empty
[ ] 9. Update AGENT-MANIFEST.yaml status: done
[ ] 10. Update FILE-MAP.md §Sync checklist (all files)
[ ] 11. Update AGENT-START.md current_task → next id
[ ] 12. Report: Architect, documentation status: ...
```

---

## Decision tree (گم نشو)

```text
Am I on the current_task in AGENT-START.md?
  NO → STOP · read AGENT-START · do not skip ahead

Is this IMPLEMENT or TEST?
  TEST before IMPLEMENT for same parent → STOP · wrong order

Is file in manifest?
  NO → STOP · ask Architect

Did VERIFY fail?
  YES → STOP · fix · do not start next nano

Does fact conflict with AGENT-CONTEXT?
  YES → STOP · ask Architect · do not guess

Tempted to refactor adjacent code?
  YES → STOP · out of scope for this nano
```

---

## Nano types

| Type | AI action |
|------|-----------|
| IMPLEMENT | Write production code per DO THIS block only |
| TEST | Write spec file · run VERIFY · min 2 real asserts |

---

## After epic complete

1. Run epic gate VERIFY from spec bottom
2. Check `p3-exit-checklist.md` epic section
3. Move to next epic first nano in AGENT-MANIFEST.yaml
