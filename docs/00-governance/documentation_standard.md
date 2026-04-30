Document-ID: MKT-DOC-ANALYSIS-STANDARD-V2
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Analysis Standard v2

## 1. Purpose

Define one standard structure for all active analysis documents to keep quality and consistency stable.

---

## 2. Required Structure (for every new analysis doc)

1. `Purpose`
2. `Scope`
3. `Assumptions`
4. `Canonical Terms and Statuses`
5. `Requirements/Rules`
6. `In Scope / Out of Scope`
7. `Risks and Mitigations`
8. `Traceability Links`
9. `Acceptance Criteria`

---

## 3. Canonical Consistency Rules

- Use terminology from `docs/20-architecture/canonical_framework.md`.
- Do not introduce new status names without updating canonical framework.
- Use leader-centric, tenant-scoped wording.
- Do not include global cross-leader discovery assumptions in active v2 docs.

---

## 4. ID and Naming Rules

- Requirement IDs: `FR-XX`, `NFR-XX`
- Decision IDs: `DEC-V2-XXX`
- Delta decisions: `DEC-DELTA-XXX`
- File naming: `<topic>_v2_EN.md` for active finalized docs
- Flow canonical path policy: `docs/20-architecture/flows/*.md` is the authoritative active flow location
- ID lineage policy is mandatory: `FR/NFR` (product baseline) MUST map to `SR-FR/SR-NFR` (system baseline) with explicit traceability checks

---

## 5. Review Checklist

- English-only language
- No duplicate sections
- No contradictory status definitions
- Clear scope boundary
- At least one traceability reference to source/canonical docs
