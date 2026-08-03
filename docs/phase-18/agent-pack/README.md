# P5 — Enterprise Evolution (agent pack)

```yaml
phase: P5
version: 2.9-ai-friendly
status: complete
authority: docs/phase-18/agent-pack
promoted_from: TEMP/p5 (PSR-2c — fresh-clone authority)
nano_total: 56
nano_done: 56
current_task: null
exit_core: P5-B-N-016
exit_full: P5-E-N-006
doc_sync: docs/phase-18/agent-pack/DOC-SYNC-INDEX.md
agent_pack_score: 9.95/10
doc_integrity_score: 9.9/10
```

## Authority

This directory is the **promoted** P5 agent pack formerly under local scratch `TEMP/p5/`.

| Rule | Detail |
| --- | --- |
| Why promote | `TEMP/` is gitignored scratch; CI clones do not ship it → exit/integrity specs (`p5-doc-integrity`, `platform-*-exit`) fail with ENOENT |
| Canonical sync | [`DOC-SYNC-INDEX.md`](./DOC-SYNC-INDEX.md) — frozen fields (`nano_done`, `exit_core`, scores) |
| Epic SoT | Phase-18 Markdoc under `docs/phase-18/*.mdoc`; nano specs here are execution history |
| Do not restore | Re-creating repo-root `TEMP/p5` for CI is forbidden — keep authority under `docs/` |

Integrity proofs: `apps/api/test/p5-doc-integrity.spec.ts`, `p5-anti-drift-contract.spec.ts`, `p5-preservation-gate.spec.ts`, `platform-*-exit.spec.ts`.

## Agent pack (read order)

1. `DOC-SYNC-INDEX.md` ← **canonical fields**
2. `AGENT-START.md` ← AI entry
3. `AGENT-MANIFEST.yaml` ← machine tasks
4. `ANTI-DRIFT.md` ← stop patterns
5. `PRESERVATION-CHECKLIST.md` ← PC-01..10
6. `FILE-MAP.md` ← nano → files
7. `p5-exit-checklist.md` ← Path A / Path B
8. Epic nano specs `p5-a-…` … `p5-e-…`
9. `wizard-denali-enterprise-assessment.md` · `ROADMAP-INDEX.md`

## EPIC map

| EPIC | Nano spec | Phase-18 SoT |
| --- | --- | --- |
| P5-A | `p5-a-cutover-pilot.md` | `../platform-metadata-cutover-pilot.mdoc` |
| P5-B | `p5-b-denali-operator-parity.md` | `../platform-denali-operator-parity.mdoc` |
| P5-C (optional) | `p5-c-workspace-commerce-config.md` | `../platform-workspace-commerce.mdoc` |
| P5-D (optional) | `p5-d-integrations-plane.md` | `../platform-integrations-plane.mdoc` |
| P5-E (optional) | `p5-e-registrations-finance.md` | `../platform-registrations-finance-tranche.mdoc` |
