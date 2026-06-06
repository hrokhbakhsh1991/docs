# Documentation Debt Registry (Phases 0–5)

> **Authority:** [MIGRATION-MAP.md §19](MIGRATION-MAP.md#۱۹-documentation-governance--dod) (Docs-as-Code)  
> **Gate:** `pnpm run guard:doc-sync` · `pnpm run doc-gate`  
> **Retrofit completed:** 2026-06-03 (Phases 0–3)

---

## Compliance checklist (§19)

| Requirement                          | P0  | P1  | P2  | P3  | P4  | P5  |
| ------------------------------------ | --- | --- | --- | --- | --- | --- |
| Phase guide in `docs/`               | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  |
| MAP §11 row + Gate table             | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  |
| `phase-registry.json` entry          | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  |
| Phase guide in **Markdoc** (`.mdoc`) | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  |
| Forensic / integrity audit `.mdoc`   | ✅  | ✅  | ✅  | ✅  | ⏳  | ⏳  |
| Package `README.md` → MAP            | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  |
| Architecture diagram in phase doc    | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  |
| `guard:doc-sync`                     | ✅  | ✅  | ✅  | ✅  | ✅  | ✅  |

---

## Phase 0 — `phase-0-foundation.mdoc`

| ID        | Issue                        | Status                                                      |
| --------- | ---------------------------- | ----------------------------------------------------------- |
| DOC-P0-01 | No Markdoc canonical         | **Fixed** — `phase-0-foundation.mdoc`                       |
| DOC-P0-02 | No Markdoc audit             | **Fixed** — `audits/phase-0-foundation-doc-compliance.mdoc` |
| DOC-P0-03 | Missing workspace-sdk README | **Fixed**                                                   |
| DOC-P0-04 | Missing config README        | **Fixed**                                                   |
| DOC-P0-05 | No §19 banner                | **Fixed** (mdoc + legacy `.md` banner)                      |

---

## Phase 1 — `phase-1-platform-core.mdoc`

| ID        | Issue                           | Status                                                         |
| --------- | ------------------------------- | -------------------------------------------------------------- |
| DOC-P1-01 | No Markdoc canonical            | **Fixed**                                                      |
| DOC-P1-02 | No compliance audit             | **Fixed** — `audits/phase-1-platform-core-doc-compliance.mdoc` |
| DOC-P1-03 | Missing platform-core README    | **Fixed**                                                      |
| DOC-P1-04 | Missing engine pipeline diagram | **Fixed** — §1.4 mermaid in mdoc                               |
| DOC-P1-05 | No §19 banner                   | **Fixed**                                                      |

---

## Phase 2 — `phase-2-design-system.mdoc`

| ID        | Issue                        | Status                                                         |
| --------- | ---------------------------- | -------------------------------------------------------------- |
| DOC-P2-01 | No Markdoc phase guide       | **Fixed**                                                      |
| DOC-P2-02 | Forensic only `.md`          | **Fixed** — `phase-2-zero-debt-forensic-audit-2026-06-02.mdoc` |
| DOC-P2-03 | Stale “apps/ does not exist” | **Fixed** in mdoc forensic                                     |
| DOC-P2-04 | No mermaid diagram           | **Fixed** — §1.1.1 visual layer DAG                            |
| DOC-P2-05 | Missing package READMEs (×3) | **Fixed**                                                      |
| DOC-P2-06 | Appendix Prisma on apps/api  | **Fixed** — phase-3 §18A appendix (in-memory 3.2)              |
| DOC-P2-07 | No §19 banner                | **Fixed**                                                      |

---

## Phase 3 — `phase-3-design-system.mdoc`

| ID        | Issue                              | Status                                                        |
| --------- | ---------------------------------- | ------------------------------------------------------------- |
| DOC-P3-01 | No Markdoc phase guide             | **Fixed** — `phase-3-design-system.mdoc`                      |
| DOC-P3-02 | Postgres implied as API SoT        | **Fixed** — in-memory §10.1 / §17                             |
| DOC-P3-03 | API tenant doc vs code (P3-INT-02) | **Fixed** — code + §10.4 + forensic test                      |
| DOC-P3-04 | No integrity audit                 | **Fixed** — `phase-3-documentation-integrity-2026-06-03.mdoc` |
| DOC-P3-05 | `apps/api` README missing          | **Fixed**                                                     |
| DOC-P3-06 | Web dev session undocumented       | **Fixed** — §11.2                                             |

**Soft backlog (documented, non-blocking):** Playwright smoke · Select/Checkbox subpaths (3.3.x).

---

## Phase 4 — `phase-4-tenant-kernel.mdoc`

| ID        | Issue                                                    | Status                                                                |
| --------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| DOC-P4-01 | Registry + modular `phase-4/` tree                       | **Fixed**                                                             |
| DOC-P4-02 | T3 interop §0.4 FA/EN + workspace-interoperability-model | **Fixed** — 2026-06-04                                                |
| DOC-P4-03 | Forensic `.mdoc` at closure                              | **SCAFFOLD** — `audits/phase-4-zero-debt-forensic-audit.mdoc` PENDING |
| DOC-P4-04 | GAP register + honest scores                             | **Fixed** — PHASE-4-GAP-REGISTER.md                                   |
| DOC-P4-05 | Red-flag status report                                   | **Fixed** — `reports/phase-3.2-red-flag-status-2026-06-04.md`         |
| DOC-P4-06 | Precision pack (pre-code doc 100)                        | **Fixed** — `appendices/PRECISION-DOC-INDEX.md` + 6 modules           |

---

## Phase 5 — `phase-5-canonical-schema.mdoc`

| ID        | Issue                                                   | Status                                                   |
| --------- | ------------------------------------------------------- | -------------------------------------------------------- |
| DOC-P5-01 | Registry entry + expanded mdoc for doc-sync             | **Fixed** — 2026-06-04                                   |
| DOC-P5-02 | `phase-5:gate` in package.json                          | **Fixed**                                                |
| DOC-P5-03 | Forensic `.mdoc` at closure                             | **Pending** — on Phase 5 Closed                          |
| DOC-P5-04 | Industry + continuity + workspace-data-layer appendices | **Fixed** — doc composite **100**                        |
| DOC-P5-05 | Research T3 banner + forbid T0 body                     | **Fixed** — 2026-06-04                                   |
| DOC-P5-06 | Critical audit + PRECISION pack + honest scores         | **Fixed** — PHASE-5-GAP-REGISTER, scaffold vs behavioral |
| DOC-P5-07 | Forensic scaffold                                       | **SCAFFOLD** — phase-5-zero-debt-forensic-audit.mdoc     |

---

## Integrity score (documentation)

| Metric                                 | Before retrofit | After                         |
| -------------------------------------- | --------------- | ----------------------------- |
| Phase Markdoc guides (0–5)             | 0/6             | **6/6**                       |
| Markdoc audits (0–3 closed)            | 0/4             | **4/4** (4–5 pending closure) |
| **Documentation integrity (registry)** | ~35%            | **100%** for `guard:doc-sync` |

Phases **0–5** are in **`phase-registry.json`**. Closure forensic audits for phases 4–5 remain **on gate green**, not doc-sync alone.

---

## Phase 6 — `phase-6-denali-workspace.md`

| ID        | Issue              | Status                                                        |
| --------- | ------------------ | ------------------------------------------------------------- |
| DOC-P6-01 | PEK doc pack       | **Fixed** — `docs/phase-6/`                                   |
| DOC-P6-02 | Research synthesis | **Fixed** — `research/phase-6-denali-workspace-research.md`   |
| DOC-P6-03 | Forensic scaffold  | **SCAFFOLD** — `audits/phase-6-zero-debt-forensic-audit.mdoc` |

---

## Phase 7 — `phase-7-platform-dod.md`

| ID        | Issue                   | Status                                                                    |
| --------- | ----------------------- | ------------------------------------------------------------------------- |
| DOC-P7-01 | PEK doc pack            | **Fixed** — `docs/phase-7/` (~35 core files)                              |
| DOC-P7-02 | Research synthesis      | **Fixed** — `research/phase-7-workspace-hardening-research.md`            |
| DOC-P7-03 | PLATFORM-CONTINUITY-0-7 | **Fixed** — `appendices/PLATFORM-CONTINUITY-0-7.md`                       |
| DOC-P7-04 | phase-7:guard wired     | **Fixed** — semantic hardening v2 (Actions, TG-P7-005, smoke/adversarial) |
| DOC-P7-05 | Forensic scaffold       | **SCAFFOLD** — `audits/phase-7-zero-debt-forensic-audit.mdoc` (PENDING)   |
| DOC-P7-06 | Markdoc canonical       | **Pending** — `.mdoc` hub at gate closure                                 |
