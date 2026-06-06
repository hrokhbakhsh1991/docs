# Forensic template — Phase 5 closure

> **SOURCE OF TRUTH:** MAP §16 Phase 5 forensic checkpoint · DEL-P5-012

```yaml
forensic_meta:
  report_path: reports/phase-5-forensic-audit-YYYY-MM-DD.md
  contract_scaffold: apps/api/test/phase-5.contract.spec.ts
  contract_behavioral_outbox: apps/api/test/outbox-transactional.spec.ts
  purity_score_minimum: 8
  integration_path: Postgres + outbox + RLS
```

## Required sections

1. Liar's Protocol — doc claim vs runtime proof
2. Gate Drift — `phase-5:gate` vs stale narrative
3. P0/P1 storage adversarial results (P5-6-A02)
4. Big-O table per repository/outbox handler (DEL-P5-013)
5. Simplicity Proof or waiver per §17
6. Verification table 1:1 §18 (P5-6-A07)
7. BLOCKER-P5-\* disposition
8. BLOCKER-P5-011 waiver if starter-only plugin test

## Pass condition

- Purity Score >= 8 on Postgres/outbox path
- phase_dod hard ALL PASS
- No open BLOCKER without Architect waiver

**Action:** P5-6-A05 · **REQ:** REQ-P5-028
