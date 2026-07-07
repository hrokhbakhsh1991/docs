# P5 — Agent Loop

1. Read `DOC-SYNC-INDEX.md` — canonical yaml (task, scores, exit)
2. Read `AGENT-START.md` — must match DOC-SYNC `current_task`
3. Read `AGENT-CONTEXT.md` + `PRESERVATION-CHECKLIST.md` + `ANTI-DRIFT.md`
4. Read `p5-denali-safety.md`
5. One nano from epic spec + `AGENT-MANIFEST.yaml`
6. DOC or first IMPLEMENT → sync `docs/phase-18/*.mdoc` + TEMP epic
7. Touch manifest files only (FILE-MAP list)
8. VERIFY from spec (≥2 asserts)
9. Update DOC-SYNC + START + MANIFEST + FILE-MAP + exit checklist
10. STOP if red or AD-S0-* violation
11. Run `pnpm run p5:gate` (includes `p5-doc-integrity.spec.ts`)
12. If `current_task: null` → **P5 closed**; stop nano loop · run `p5:gate` only on regression
