# Documentation Debt Registry (Phases 0–3)

> **Authority:** [MIGRATION-MAP.md §19](MIGRATION-MAP.md#۱۹-documentation-governance--dod) (Docs-as-Code)  
> **Gate:** `pnpm run guard:doc-sync` · `pnpm run doc-gate`  
> **Retrofit completed:** 2026-06-03 (Phases 0–3)

---

## Compliance checklist (§19)

| Requirement | P0 | P1 | P2 | P3 |
|-------------|----|----|-----|-----|
| Phase guide in `docs/` | ✅ | ✅ | ✅ | ✅ |
| MAP §11 row + Gate table | ✅ | ✅ | ✅ | ✅ |
| `phase-registry.json` entry | ✅ | ✅ | ✅ | ✅ |
| Phase guide in **Markdoc** (`.mdoc`) | ✅ | ✅ | ✅ | ✅ |
| Forensic / integrity audit `.mdoc` | ✅ | ✅ | ✅ | ✅ |
| Package `README.md` → MAP | ✅ | ✅ | ✅ | ✅ |
| Architecture diagram in phase doc | ✅ | ✅ | ✅ | ✅ |
| `guard:doc-sync` | ✅ | ✅ | ✅ | ✅ |

---

## Phase 0 — `phase-0-foundation.mdoc`

| ID | Issue | Status |
|----|-------|--------|
| DOC-P0-01 | No Markdoc canonical | **Fixed** — `phase-0-foundation.mdoc` |
| DOC-P0-02 | No Markdoc audit | **Fixed** — `audits/phase-0-foundation-doc-compliance.mdoc` |
| DOC-P0-03 | Missing workspace-sdk README | **Fixed** |
| DOC-P0-04 | Missing config README | **Fixed** |
| DOC-P0-05 | No §19 banner | **Fixed** (mdoc + legacy `.md` banner) |

---

## Phase 1 — `phase-1-platform-core.mdoc`

| ID | Issue | Status |
|----|-------|--------|
| DOC-P1-01 | No Markdoc canonical | **Fixed** |
| DOC-P1-02 | No compliance audit | **Fixed** — `audits/phase-1-platform-core-doc-compliance.mdoc` |
| DOC-P1-03 | Missing platform-core README | **Fixed** |
| DOC-P1-04 | Missing engine pipeline diagram | **Fixed** — §1.4 mermaid in mdoc |
| DOC-P1-05 | No §19 banner | **Fixed** |

---

## Phase 2 — `phase-2-design-system.mdoc`

| ID | Issue | Status |
|----|-------|--------|
| DOC-P2-01 | No Markdoc phase guide | **Fixed** |
| DOC-P2-02 | Forensic only `.md` | **Fixed** — `phase-2-zero-debt-forensic-audit-2026-06-02.mdoc` |
| DOC-P2-03 | Stale “apps/ does not exist” | **Fixed** in mdoc forensic |
| DOC-P2-04 | No mermaid diagram | **Fixed** — §1.1.1 visual layer DAG |
| DOC-P2-05 | Missing package READMEs (×3) | **Fixed** |
| DOC-P2-06 | Appendix Prisma on apps/api | **Fixed** — phase-3 §18A appendix (in-memory 3.2) |
| DOC-P2-07 | No §19 banner | **Fixed** |

---

## Phase 3 — `phase-3-design-system.mdoc`

| ID | Issue | Status |
|----|-------|--------|
| DOC-P3-01 | No Markdoc phase guide | **Fixed** — `phase-3-design-system.mdoc` |
| DOC-P3-02 | Postgres implied as API SoT | **Fixed** — in-memory §10.1 / §17 |
| DOC-P3-03 | API tenant doc vs code (P3-INT-02) | **Fixed** — code + §10.4 + forensic test |
| DOC-P3-04 | No integrity audit | **Fixed** — `phase-3-documentation-integrity-2026-06-03.mdoc` |
| DOC-P3-05 | `apps/api` README missing | **Fixed** |
| DOC-P3-06 | Web dev session undocumented | **Fixed** — §11.2 |

**Soft backlog (documented, non-blocking):** Playwright smoke · Select/Checkbox subpaths (3.3.x).

---

## Integrity score (documentation)

| Metric | Before retrofit | After |
|--------|-----------------|-------|
| Phase Markdoc guides (0–3) | 0/4 | **4/4** |
| Markdoc audits (0–3) | 0/4 | **4/4** |
| **Documentation integrity** | ~35% | **100%** |

Phases **0–3** are **documentation-synced** for §19. **Phase 3 Zero-Debt Verified** requires `pnpm run phase-3:gate` exit 0 (see integrity report).
