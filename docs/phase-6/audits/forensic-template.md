# Phase 6 — Forensic audit template

```yaml
template_version: "2026-06-04"
output_md: reports/phase-6-forensic-audit-YYYY-MM-DD.md
output_mdoc: docs/audits/phase-6-zero-debt-forensic-audit.mdoc
rubric: ../appendices/FORENSIC-RUBRIC.md
minimum_score: 8.0
```

## Report sections (fill at 6.9 only)

1. **Gate evidence** — `phase-6:gate` log path, exit code
2. **Dimension scores** — 10 rows from FORENSIC-RUBRIC
3. **REQ sample** — 5 random REQ-P6 with spec file + last CI run
4. **Anti-hollow** — confirm not doc-guard-only closure
5. **Verdict** — PASS if total ≥ 8.0 else FAIL

## mdoc sync

Update `verdict:` in mdoc only when 6.9 DoD met — never from doc-only guard.
