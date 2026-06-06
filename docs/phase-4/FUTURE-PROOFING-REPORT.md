# Phase 4 — Future Architecture Review Board report

```yaml
report_meta:
  date: "2026-06-04"
  role: Future Architecture Review Board
  scope: docs/phase-4/ + binding repo scripts (package.json, phase-4-guard.mjs)
  evaluation_axes:
    - "2026 documentation & platform engineering best practices"
    - "AI-native development workflows"
    - "Large-scale SaaS delivery patterns"
    - "Multi-tenant architecture patterns"
    - "Observability standards (progressive adoption)"
    - "Platform engineering / CI gate design"
  verdict: PASS_WITH_ADVISORY_DEBT
  contracts_preserved: true
  applied_improvements: 6
  rejected_improvements: 12
```

---

## Executive summary

Phase 4 documentation is **well-aligned with 2026 AI-native platform specs**: modular SoT, tiered agent load (T0–T3), machine-readable DAG, traceability (R→A→V→C), and explicit deferrals (outbox → Phase 5, OTel → Phase 7). The **implementation architecture** correctly prioritizes **shared-database RLS + CASL**, fail-closed tenant context, and in-process events as a **deliberate scaffold**—not production-scale eventing.

**Primary future pressure** is not doc quality—it is **operational scale**: nested heavy gates (FR-01), in-process bus before outbox (FR-04), and observability hooks without mandatory correlation tests (FR-06). The board **accepted six documentation improvements** that increase agent determinism and maintainability **without** changing P4-E-* or `phase-4:gate` contracts.

---

## Review against standards

| Standard lens | Phase 4 posture | Gap / debt |
|---------------|-----------------|------------|
| **2026 doc & platform eng** | Modular hub, `REPO_SCRIPTS_OVER_STALE_MD`, ci.md SoT | Gate chain latency at monorepo growth (FR-01) |
| **AI-native workflows** | T0 router, knowledge-index, execution-action-index | Human monolith T3 drift risk (FR-09); TH-1 non-P4-E (FR-08) |
| **Large-scale SaaS** | Explicit Phase 5/7 deferrals; forbidden scope creep | No load/chaos gates; single-region assumption |
| **Multi-tenant patterns** | RLS + `set_config` + CASL; host parse; two-tenant e2e | Pool session leak class (FR-03); ORM bypass (FR-02) |
| **Observability** | Scaffold: correlation ID, structured logs, event envelope | Full OTel deferred; correlation not P4-E (FR-06) |
| **Platform engineering** | phase-4:gate + p4_* reports; traceability audits | Pre-commit omits phase-4:gate by design (FR-11) |

---

## Identified risks

### Future bottlenecks

| ID | Risk | Likelihood | Impact |
|----|------|------------|--------|
| FR-01 | `phase-4:gate` = build + full test + **nested** `phase-3:gate` | High as repo grows | CI queue, slow 4.6 closure |
| FR-04 | In-process `platform-events` before outbox relay | Certain at multi-instance | Lost/dup events across pods |
| FR-11 | Developers assume Husky = phase complete | Medium | Late discovery at 4.6 |

### Scaling risks

| ID | Risk | Phase boundary |
|----|------|----------------|
| FR-02 | Raw SQL / Prisma outside tenant transaction | 4.2 — data leak |
| FR-03 | Connection pool + `set_config` session scope | 4.2 — cross-tenant bleed |
| FR-05 | SCALE-01 doc-only Big-O proof | 4.2 — hot tenant rows |
| FR-04 | Event bus not durable | 5+ required for scale-out |
| — | Shared DB RLS vs enterprise schema-per-tenant | Correctly deferred Phase 7 |

### Maintainability risks

| ID | Risk |
|----|------|
| FR-09 | `phase-4-tenant-kernel.md` monolith vs modular tree |
| FR-10 | Parallel 4.4 ∥ 4.5 on shared `apps/api` paths |
| FR-12 | Guard minimum test counts invite threshold gaming |
| — | Legacy § references in T3 human docs |

### AI execution risks

| ID | Risk |
|----|------|
| FR-07 | T0 loads narrative overview → wrong decisions |
| FR-08 | Skips 4.4 / TH-1 because no P4-E-* |
| — | grep-only closure temptation (mitigated by `grep_only_rule`) |
| — | Stale monolith contradicting `phase-4-ai-exec.md` |

---

## Accepted improvements (applied)

| # | Improvement | Files touched | Rationale | Expected impact |
|---|-------------|---------------|-----------|-----------------|
| A1 | **Future risk signals registry** (machine-readable FR-01–FR-12) | `appendices/future-risk-signals.md` | Gives agents deterministic pre-PR scan without new gates | **+AI readability**; fewer boundary regressions |
| A2 | **P4-R-RISK-01** rule in agent router | `phase-4-ai-exec.md` | Binds scan to 4.6 / tenant-touching PRs | **+Execution clarity** |
| A3 | **T0 boot** includes risk scan step | `appendices/agent-load-tiers.md` | Same scan at agent cold path | **+Determinism** |
| A4 | **Knowledge-index** owners for board + signals | `appendices/knowledge-index.md` | Single SoT for new artifacts | **+Maintainability** |
| A5 | **Gate scaling note** (FR-01, FR-11) | `ci.md` | Documents CI bottleneck without changing scripts | **+Platform eng literacy** |
| A6 | **Correlation ID smoke pattern** (recommended, non-gating) | `appendices/observability.md` | Aligns with 2026 observability practice without P4-E creep | **+Quality** at low cost |

**Contracts unchanged:** all P4-E-* IDs, `p4_*` guards, `pnpm run phase-4:gate` four-step chain, `phase_5_entry_requires`, `forbidden_phase_4`.

---

## Rejected improvements

| # | Proposal | Rationale for rejection | Expected impact if forced |
|---|----------|-------------------------|---------------------------|
| R1 | Mandatory OpenTelemetry in Phase 4 | Violates explicit Phase 7 deferral; scope creep | Slower delivery; dependency churn |
| R2 | New P4-E-* for correlation ID | Observability scaffold is RECOMMENDED_NOT_GATING | Gate fatigue; false closure failures |
| R3 | Husky runs full `phase-4:gate` every commit | FR-01: unacceptable local/CI latency | Developer bypass culture |
| R4 | `phase-4:gate:fast` script now | No implemented profile; doc-only promise misleads | Drift vs package.json |
| R5 | Shard phase-4:gate per package in docs only | Without scripts, agents assume nonexistent commands | **FAIL** chains |
| R6 | Replace in-process bus in Phase 4 | Outbox forbidden until Phase 5 | Breaks DAG / forbidden_phase_4 |
| R7 | Schema-per-tenant or dedicated DB per tenant | Enterprise pattern deferred Phase 7 | Premature ops complexity |
| R8 | Load-test gate (k6/Locust) in Phase 4 | No infra contract; not in enforcement table | Flaky CI |
| R9 | Auto-sync monolith from modular tree | High automation cost; T3 is human-only | Wrong SoT inversion |
| R10 | Collapse modular docs to single file | Regresses AI readability scores (71→89) | Agent context bloat |
| R11 | TH-1 → new P4-E-TH-01 | Would require code + guard + matrix change | Contract churn mid-phase |
| R12 | AI closure without P4-E-* tests | Violates Zero-Debt Covenant / grep_only_rule | Security regression |

---

## Recommendations (future phases — not applied in Phase 4)

| Priority | Recommendation | Target |
|----------|----------------|--------|
| P0 | Implement Phase 5 outbox + relay before multi-instance API deploy | Phase 5 |
| P0 | Add integration test: Prisma write path always inside `withTenantTransaction` | 4.2 code |
| P1 | Optional `phase-4:gate:fast` in package.json (build + scoped filters) | Platform eng |
| P1 | Raise `TENANT_KERNEL_TEST_MIN_phase4` when real coverage exists | gate-thresholds.mjs |
| P2 | OpenTelemetry + per-tenant metrics design (cardinality controls) | Phase 7 |
| P2 | Monolith banner: “non-authoritative — see docs/phase-4/” | T3 human doc |
| P3 | Chaos test: tenant A token cannot read B after pool churn | 4.2+ hardening |

---

## Score projection (documentation only)

| Dimension | Current (AI-READABILITY) | Post board pass | Notes |
|-----------|--------------------------|-----------------|-------|
| Readability | 89 | **90** | Risk signals reduce narrative grep |
| Determinism | 93 | **94** | P4-R-RISK-01 + FR-* IDs |
| Execution clarity | 91 | **93** | Pre-4.6 scan path explicit |
| **Composite** | 91 | **92** | Implementation debt remains advisory |

---

## Agent quick reference

| Task | Load |
|------|------|
| Implement subphase | T0 per `agent-load-tiers.md` |
| Pre-4.6 / tenant PR | `appendices/future-risk-signals.md` + P4-R-RISK-01 |
| Gate debug | T1: `ci.md`, `phase-4-guard.md` |
| Architecture dispute | T2: overview, state-machine |
| Human narrative | T3 only — not execution SoT |

---

## Verdict

```yaml
verdict: PASS_WITH_ADVISORY_DEBT
architecture_fit_2026: strong_documentation_moderate_runtime_scale_headroom
blocking_issues: none_in_docs
advisory_debt: FR-01 FR-04 FR-06 FR-08 FR-09
next_mandatory_scale_gate: Phase_5_outbox
```

**Architect, documentation status: Updated.** Link to docs: [`docs/phase-4/FUTURE-PROOFING-REPORT.md`](FUTURE-PROOFING-REPORT.md), [`docs/phase-4/appendices/future-risk-signals.md`](appendices/future-risk-signals.md).
