# Documentation curation — validation report

```yaml
curation_meta:
  date: "2026-06-04"
  scope: docs/phase-{0,1,2,3,4}/ AI-exec hubs + stubs + phases index
  canonical_human: docs/*.mdoc per phase-registry.json
  execution_truth: package.json + scripts/guards/*.mjs
```

---

## Sections removed or merged

| Location | Action | Reason |
|----------|--------|--------|
| `phase-2/phase-2.ai-exec.index.md` duplicate `## AGENT EXECUTION ALGORITHM` | MERGED — duplicate | Broken heading pair |
| `phase-2/phase-2.ai-exec.index.md` duplicate `## DOC_DRIFT REGISTER` | MERGED — duplicate | Broken heading pair |
| `phase-0/phase-0-guards.md` `## From subphase 0.5` block | MERGED — duplicate | Same as `phase_0_guard_script_checks` |
| `phase-0/subphases/0.5-ci-gate.md` covenant + guard_checks + stale g1–g5 | MERGED — duplicate | Canonical: `phase-0-guards.md`, `phase-0-ci.md` |
| `phase-0/phase-0-enforcement.md` abbreviated HO-01..HO-10 list | MERGED — duplicate | Canonical: `phase-0-overview.md` §3.1–3.3 |
| `phase-{0,1,2,3}/MIGRATION-REPORT.md` (×4) | REMOVED — irrelevant | Split meta; superseded by this report |
| `phase-{0,1,2,3}/VALIDATION-REPORT.md` (×4) | REMOVED — irrelevant | Split meta; superseded by this report |

---

## Sections kept (executable)

| Layer | Path pattern | Role |
|-------|--------------|------|
| Agent entry | `phase-N/phase-N.ai-exec.index.md` | AGENT_START_SEQUENCE, doc_drift, fail_conditions |
| Overview | `phase-N-overview.md` | phase_id, subphases, constraints |
| State / DAG | `phase-N-state-machine.md` | transitions, forbidden_overlap |
| Guards | `phase-N-guards.md` or `phase-4-guard.md` | machine-checkable ids |
| CI | `phase-N-ci.md` | `phase-N:gate` ordered steps |
| Enforcement | `phase-N-enforcement.md` | forbidden, DoD, next-phase entry |
| Subphases | `phase-N/subphases/*.md` | exit_criteria per subphase |
| Audits | `phase-N/audits/*.md` | forensic + verification matrix |
| Appendices | `phase-N/appendices/*.md` | commands, test-matrix, dependency-graph |
| Stubs | `phase-N-*.ai-exec.md` (root docs/) | redirect only |
| Markdoc | `phase-N-*.mdoc` | human canonical + doc-sync |

---

## Per-phase actionable summary

| Phase | Entry | Gate | Guard ids |
|-------|-------|------|-----------|
| 0 | `phase-0/phase-0.ai-exec.index.md` | `phase-0:gate` | test:phase-0 (10 covenants), g4, g4b, g6, g7 |
| 1 | `phase-1/phase-1.ai-exec.index.md` | `phase-1:gate` | g1, g2b, g2, g2c, g2d, g11, g12, g13, g10, g3, g3b, g3c, g4, g5, g6, g8 |
| 2 | `phase-2/phase-2.ai-exec.index.md` | `phase-2:gate` | p2_* (14 checks) |
| 3 | `phase-3/phase-3.ai-exec.index.md` | `phase-3:gate` | p3_* (17 checks) |
| 4 | `phase-4/phase-4.ai-exec.index.md` | `phase-4:gate` | P4-E-* + phase-4-guard.mjs |

---

## Gaps and blockers

| ID | Gap | Severity |
|----|-----|----------|
| GAP-P0-P1E05 | Remote GitHub Actions parity (P1E-05) — agent must verify workflow | soft |
| GAP-NARRATIVE | `phase-*-*.md` Persian/narrative mirrors may lag `.mdoc` — agents use `phase-N/` + scripts | doc_drift by design |
| GAP-P4 | Phase 4 open — narrative `phase-4-tenant-kernel.md` + modular `phase-4/` both active | expected |
| BLOCKER-NONE | No FAIL on phase detection for phases 0–4 modular hubs | — |

---

## Agent load order (all phases)

```yaml
load_sequence:
  1: docs/phases/README.md
  2: docs/phase-{N}/phase-{N}.ai-exec.index.md
  3: docs/phase-{N}/phase-{N}-state-machine.md
  4: docs/phase-{N}/phase-{N}-guards.md OR phase-4-guard.md
  5: docs/phase-{N}/subphases/<active>.md
  6: pnpm run phase-{N}:gate
rule: REPO_SCRIPTS_OVER_STALE_MD — bind doc_drift registers in each index
```

---

## Completeness (post-curation)

| Check | Result |
|-------|--------|
| Duplicate index headings (phase 2) | FIXED |
| Duplicate guard YAML (phase 0) | FIXED |
| Split MIGRATION/VALIDATION reports (0–3) | CONSOLIDATED here |
| All subphase files 0.1–0.6, 1.1–1.6, 2.x, 3.x, 4.0–4.6 | KEPT |
| All guard matrices | KEPT |
| Stubs `*.ai-exec.md` | KEPT |
