# P5 — Documentation sync index (canonical)

**Rule:** When any field below changes, update ALL files in §Sync set + run `p5-doc-integrity.spec.ts`.

```yaml
pack_version: 2.9-ai-friendly
doc_integrity_score: 9.9/10
agent_pack_score: 9.95/10
phase: P5
status: in_progress
nano_total: 56
nano_done: 3
current_task: P5-A-N-004
current_epic: P5-A
exit_core: P5-B-N-016
exit_full: P5-E-N-006
prerequisite: P4-complete
```

## Nano progress (honest)

| Nano | Status | Evidence |
|------|--------|----------|
| P5-A-N-001 | ✅ done | p4/p5 gate → guard:p3-denali-covenant |
| P5-A-N-002 | ✅ done | docs/phase-18/ pack (5 mdoc + README) |
| P5-A-N-003 | ✅ done | deriveMetadataCutoverStage + CO-01..05 |
| P5-A-N-004 | ⬜ next | Super Admin cutover badge |
| P5-A-N-005..014 | ⬜ | see p5-a-cutover-pilot.md |

## Score definitions (do not conflate)

| Metric | Value | Meaning |
|--------|-------|---------|
| `agent_pack_score` | 9.95/10 | AI agent doc pack quality (TEMP + phase-18 + gates) |
| `doc_integrity_score` | 9.9/10 | Cross-file field sync (this index + DOC-SYNC spec) |
| `enterprise_assessment` post-core | ≥9.2/10 | Product/runtime after P5-B — separate from doc pack |

## Sync set (must match canonical yaml)

| File | Role |
|------|------|
| TEMP/p5/DOC-SYNC-INDEX.md | **this file — SoT** |
| TEMP/p5/AGENT-START.md | AI entry |
| TEMP/p5/AGENT-MANIFEST.yaml | machine tasks |
| TEMP/p5/README.md | agent index |
| TEMP/p5/FILE-MAP.md | nano → files |
| TEMP/p5-exit-checklist.md | path A/B exit |
| TEMP/p5-enterprise-evolution.md | human summary |
| TEMP/ROADMAP-INDEX.md | roadmap yaml block |

## EPIC optional flag (frozen)

```text
Required for Denali: P5-A, P5-B
Optional (Architect enable): P5-C, P5-D, P5-E
```

## Cross-links

| Layer | Path |
|-------|------|
| Doc SoT P5-A | docs/phase-18/platform-metadata-cutover-pilot.mdoc |
| Doc SoT P5-B | docs/phase-18/platform-denali-operator-parity.mdoc |
| Nano spec P5-A | TEMP/p5/p5-a-cutover-pilot.md |
| Preservation | TEMP/p5/PRESERVATION-CHECKLIST.md |
| Anti-drift | TEMP/p5/ANTI-DRIFT.md |
| Quality | TEMP/p5/QUALITY-AUDIT.md |
