# Phase 9 — Forensic rubric (Operator Admin)

```yaml
rubric_id: FORENSIC-RUBRIC-P9
version: "2026-06-08-v1"
minimum_score: 8.0
maximum_score: 10.0
report: docs/audits/phase-9-zero-debt-forensic-audit.mdoc
authority: subphases/9.8-operator-dod-gate.md · REQ-P9-083
reuse_from: docs/phase-7/appendices/FORENSIC-RUBRIC.md
```

## Weighted criteria

| #   | Criterion                             | Weight | Verification evidence                                      |
| --- | ------------------------------------- | ------ | ---------------------------------------------------------- |
| 1   | Identity production (9.1)             | 15     | `identity-otp.spec.ts` + `identity-session.spec.ts` exit 0 |
| 2   | Admin shell fail-closed (9.2)         | 10     | `admin-shell-access.spec.ts` · CP-9.2-01                   |
| 3   | Tours operator + wizard routing (9.3) | 15     | `tours-operator.spec.ts` · DEC-P9-007 · SMK-P9-02          |
| 4   | Users + invites RBAC (9.4)            | 10     | `identity-users.spec.ts` · P9-F-005 deny                   |
| 5   | Bookings ops transactional (9.5)      | 10     | `bookings-ops.spec.ts` · P9-F-006                          |
| 6   | Settings + template seed (9.6)        | 10     | `settings-template.spec.ts` · SMK-P9-05                    |
| 7   | Finance Denali-only (9.7)             | 5      | `finance-admin.spec.ts` · P9-F-008                         |
| 8   | E2E SMK-P9-01..08 (9.8)               | 15     | `operator-smoke.spec.ts` all grep pass                     |
| 9   | Urban owner regression                | 10     | `urban-settings-patch.spec.ts` admin **403**               |
| 10  | Genericity platform-core              | 5      | `phase-9.contract.spec.ts` zero-diff assert                |
| 11  | Doc truth sync                        | 5      | IMPLEMENTATION-TRUTH 9.1–9.7 VERIFIED_BEHAVIORAL           |

**Pass:** weighted sum ≥ **8.0** (100-point scale normalized) · `verdict: PASS` in mdoc · no P0 adversarial red row.

## Scoring formula

```text
score = sum(dimension_score_i * weight_i) / sum(weights)
```

Each dimension scored 0–10 at closure audit. `PENDING` until `pnpm run phase-9:gate` exit 0.

Full adversarial catalog: [`ADVERSARIAL-MATRIX-P9.md`](ADVERSARIAL-MATRIX-P9.md) (ADV-P9-01..15).

## P0 adversarial blockers (auto-fail)

| ID        | Condition                                 |
| --------- | ----------------------------------------- |
| ADV-P9-01 | Admin PATCH `/urban/settings` returns 200 |
| ADV-P9-02 | `(app)/dashboard` anonymous 200           |
| ADV-P9-03 | `packages/platform-core` diff non-empty   |
| ADV-P9-04 | Runtime `legacy/` import in apps          |
