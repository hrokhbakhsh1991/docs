# Finance-core — final extraction decision

```yaml
decision_id: FINANCE_CORE_EXTRACTION_DECISION
version: "1.0"
date: "2026-07-19"
verdict: A
evidence_only: true
redesign: none
```

## Decision

**A — Keep inside monorepo.**

Do **not** publish (B) and do **not** extract to a separate repository (C) on current evidence.

---

## Evidence base (only)

| Artifact | Finding used |
| -------- | ------------ |
| [`FINANCE_CORE_INTERNAL_FREEZE.md`](./FINANCE_CORE_INTERNAL_FREEZE.md) | Internal API **READY**; 0 blockers for monorepo use |
| [`FINANCE_CORE_HOSTILE_EXTERNAL_HOST.md`](./FINANCE_CORE_HOSTILE_EXTERNAL_HOST.md) | Engine **capable** with both packed tarballs; **published-only blocked** (no registry, `private`, contracts required) |
| [`FINANCE_DEPS_WORKSPACE_TO_REGISTRY.md`](./FINANCE_DEPS_WORKSPACE_TO_REGISTRY.md) | Source still `workspace:*`; pack rewrites; publish path planned, not executed |
| [`FINANCE_SEMVER_POLICY.md`](./FINANCE_SEMVER_POLICY.md) | Semver/checklist prepared; **publish: false** |
| [`FINANCE_PLATFORM_DEBT_AUDIT.md`](./FINANCE_PLATFORM_DEBT_AUDIT.md) | Open **P0 = none**; remaining debt is host P2 |
| [`FINANCE_CORE_EXTRACTION_READINESS.md`](./FINANCE_CORE_EXTRACTION_READINESS.md) | Composite packaging readiness **~62/100** |
| Package state | Both `private: true`; core depends on contracts; Host Kit in monorepo docs; outbox writer **not** in published surface |

---

## Scorecard

Scale: **cost / risk = 1 (low) … 5 (high)** · **benefit = 1 (low) … 5 (high)**.

| Option | Engineering cost | Operational cost | Maintenance benefit | Migration risk |
| ------ | ---------------: | ---------------: | ------------------: | -------------: |
| **A — Keep monorepo** | **1** | **1** | **3** | **1** |
| **B — Publish internal package** | **3** | **3** | **4** | **2** |
| **C — Separate repository** | **5** | **5** | **3** | **5** |

### Scoring rationale (evidence-tied)

**A — Keep inside monorepo**

| Dimension | Score | Why |
| --------- | ----: | --- |
| Engineering cost | 1 | Already committed, frozen, guards green; HTTP/host composition works in-tree |
| Operational cost | 1 | No registry, no dual-CI, no release train; `workspace:*` is native |
| Maintenance benefit | 3 | Single repo keeps contracts↔core↔host adapters atomic; internal freeze already delivers API stability |
| Migration risk | 1 | No consumer migration; status quo |

**B — Publish internal package** (private registry / Verdaccio / GH Packages)

| Dimension | Score | Why |
| --------- | ----: | --- |
| Engineering cost | 3 | Clear `private`, replace/pack `workspace:*`, release both packages in order, CHANGELOG discipline (policy exists; work not done) |
| Operational cost | 3 | Registry auth, publish CI, version tags, dual install paths for monorepo vs consumers |
| Maintenance benefit | 4 | Hostile sim proved tarball install + flows; enables second host **without** cloning monorepo |
| Migration risk | 2 | Semver policy + pack rewrite proven; consumers pin `0.1.0`; monorepo can keep `workspace:*` |

**C — Extract separate repository**

| Dimension | Score | Why |
| --------- | ----: | --- |
| Engineering cost | 5 | Move core **and** contracts; rewire monorepo deps; duplicate build/test/guards; docs/kit packaging |
| Operational cost | 5 | Second repo CI, cross-repo releases, version sync contracts→core, access control |
| Maintenance benefit | 3 | Same engine boundary already achieved in-package; little extra vs B for one product host |
| Migration risk | 5 | Extraction readiness ~62; published-only still blocked; missing outbox contract in package surface; every monorepo consumer must retarget |

---

## Comparison summary

```text
Prefer low cost+risk, require benefit to justify move.

A: cost 1+1, benefit 3, risk 1  →  best fit for current single-host monorepo
B: cost 3+3, benefit 4, risk 2  →  justified only when a second installable host needs registry
C: cost 5+5, benefit 3, risk 5  →  not justified by current evidence
```

---

## Final call

| Choice | Status |
| ------ | ------ |
| **A Keep inside monorepo** | **SELECTED** |
| B Publish internal package | Deferred — evidence supports **capability** of pack/install, not **need** |
| C Extract separate repository | **Rejected** on current evidence |

**Trigger to reopen B (not automatic):** a concrete second host that cannot use the monorepo workspace and requires registry install of both `@app-tour/finance-http-contracts` and `@app-tour/finance-core`.

**Trigger to reopen C:** not evidenced today; B would be evaluated before C if a second host appears.
