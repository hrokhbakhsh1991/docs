# Phase 9 — Adversarial matrix (ADV-P9)

```yaml
matrix_id: ADVERSARIAL-MATRIX-P9
version: "2026-06-08-v1"
authority: FORENSIC-RUBRIC-P9.md · phase-9-charter.md · CASL-OPERATOR-SPEC.md
closure_subphase: "9.8"
auto_fail: true
```

> P0 rows **auto-fail** forensic audit regardless of weighted score. Verified at 9.8 via specs + SMK-P9 + urban regression bundle.

---

## P0 — privilege escalation & genericity

| ID            | Attack / drift                                | Expected outcome                  | Proof command                                                |
| ------------- | --------------------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| **ADV-P9-01** | Admin PATCH `/urban/settings`                 | **403** `URBAN_OWNER_REQUIRED`    | `urban-settings-patch.spec.ts`                               |
| **ADV-P9-02** | Anonymous GET `(app)/dashboard`               | redirect login or **401**         | `admin-shell-access.spec.ts`                                 |
| **ADV-P9-03** | `packages/platform-core` diff on admin PR     | empty git diff                    | `phase-9.contract.spec.ts`                                   |
| **ADV-P9-04** | Runtime `import from 'legacy/'` in apps       | zero matches                      | `p9_no_legacy_runtime_import`                                |
| **ADV-P9-05** | Member POST `/users/invite`                   | **403**                           | `identity-users.spec.ts` P9-F-005                            |
| **ADV-P9-06** | JWT `role=admin` with DB `member`             | deny or DB-corrected role         | `identity-session.spec.ts` DELTA-NP-04                       |
| **ADV-P9-07** | `(app)/tours/new` duplicate wizard            | route absent                      | `rg '(app)/tours/new' apps/web` → zero                       |
| **ADV-P9-08** | Approve booking without outbox txn            | spec fail                         | `bookings-ops.spec.ts` P9-F-006                              |
| **ADV-P9-09** | Finance page on urban tenant                  | 404 or nav hidden                 | `finance-page.spec.ts` (nav helper today · page E2E pending) |
| **ADV-P9-10** | Doc-guard-only 9.8 closure                    | **FAIL** P9-F-009                 | `phase-9:gate` required                                      |
| **ADV-P9-16** | Unknown `moduleId` on `/settings/resources/*` | **404** `SETTINGS_MODULE_UNKNOWN` | `settings-resources.spec.ts` CP-9.6-07                       |
| **ADV-P9-17** | Cross-tenant GET equipment by id              | **403/404** RLS deny              | `settings-resources.spec.ts` CP-9.6-08                       |
| **ADV-P9-18** | Generic JSON catalog table for destinations   | **FAIL** P9-F-010 · DEC-P9-010    | schema audit · AH-9.6-05                                     |

---

## P1 — resilience (should pass at closure)

| ID            | Scenario                                         | Expected                   | Spec anchor                              |
| ------------- | ------------------------------------------------ | -------------------------- | ---------------------------------------- |
| **ADV-P9-11** | OTP brute force flood                            | rate limit **429**         | COP 9.1 · rate limiter                   |
| **ADV-P9-12** | Expired OTP challenge                            | **401** OTP_INVALID        | F-9.1-02                                 |
| **ADV-P9-13** | Cross-tenant invite token                        | **403**                    | CP-9.4-05                                |
| **ADV-P9-14** | Template save without cache bust                 | wizard stale seed fail     | F-9.6-02                                 |
| **ADV-P9-15** | SMK uses dev bearer only                         | **FAIL** AH-9.8-01         | SMK-P9-01 cookie path                    |
| **ADV-P9-19** | Tampered manifest at plugin load                 | boot **fail** or empty nav | `settings-manifest.spec.ts` CP-9.6-10    |
| **ADV-P9-20** | PUT on audit trail explorer                      | **405** read-only          | `settings-audit-trail.spec.ts` CP-9.6-06 |
| **ADV-P9-22** | Member GET `/bookings?view=ops` full tenant      | **403** or empty           | `bookings-ops.spec.ts` CP-9.5-04         |
| **ADV-P9-23** | Duplicate approve UI only under `/leader/review` | **FAIL** DEC-P9-011        | `bookings-command-center.spec.ts`        |

---

## Cross-reference

| Matrix            | Link                                                                          |
| ----------------- | ----------------------------------------------------------------------------- |
| Forbidden catalog | [`audits/verification-matrix.md`](../audits/verification-matrix.md) § P9-F-\* |
| Forensic rubric   | [`FORENSIC-RUBRIC-P9.md`](FORENSIC-RUBRIC-P9.md)                              |
| Smoke             | [`SMOKE-SCENARIO-MAP.md`](SMOKE-SCENARIO-MAP.md)                              |
