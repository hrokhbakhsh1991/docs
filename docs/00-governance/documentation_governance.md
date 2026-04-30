Document-ID: MKT-DOC-GOVERNANCE-V1
Version: v1.0
Status: Active
Owner: Product Documentation Team
Last-Updated: 2026-04-27
Language: English
Canonical-Reference: docs/20-architecture/canonical_framework.md

# Project Documentation Governance v1

## 1. Purpose

This document defines the mandatory documentation standard to be used before implementation and during ongoing delivery.
It is the single governance baseline for all active project documents.

---

## 2. Standards Baseline (Adopted)

This project uses a hybrid, practical baseline:

1. **ISO/IEC/IEEE 29148:2018**  
   Source for requirements engineering process and requirement quality.

2. **arc42 (12-section architecture template)**  
   Source for architecture documentation structure.

3. **RFC 2119 + RFC 8174 (BCP 14)**  
   Source for normative requirement wording (`MUST`, `SHOULD`, `MAY`).

4. **ADR/MADR**  
   Source for architecture/product decision recording.

5. **C4 Model**  
   Source for architecture diagram levels (Context, Container, Component, Code/optional).

---

## 3. Mandatory Document Set (Pre-Implementation)

The project is considered ready for implementation planning only when all items below exist and pass QA:

1. `docs/20-architecture/canonical_framework.md`
2. `docs/10-product/product_overview.md`
3. `docs/10-product/personas_usecases.md`
4. `docs/10-product/requirements.md`
5. `docs/10-product/ux_principles.md`
6. `docs/10-product/screens_overview.md`
7. `docs/10-product/mvp_scope.md`
8. `docs/20-architecture/data_model.md`
9. `docs/20-architecture/technical_spec.md`
10. `docs/20-architecture/decisions.md`
11. `docs/10-product/roadmap.md`
12. `docs/20-architecture/flows/*.md`
13. `docs/50-validation/archive_traceability.md`

---

## 4. Requirements Standard (ISO 29148 Aligned)

Every requirement in active documents MUST satisfy:

- Unique ID
- Clear actor/subject
- Unambiguous behavior
- Verifiable acceptance condition
- Traceability to source decision/use case/flow

Recommended requirement attributes:

- Priority
- Rationale
- Verification method
- Dependency/constraint

---

## 5. Architecture Standard (arc42 + C4 Aligned)

Architecture content MUST be organized to cover:

- goals and constraints
- context and scope
- solution strategy
- building blocks
- runtime behavior
- deployment view
- cross-cutting concepts
- decisions
- quality requirements
- risks and technical debt
- glossary

Minimum C4 diagrams required:

- Level 1: System Context
- Level 2: Container

Optional by complexity:

- Level 3: Component
- Level 4: Code-level diagram

---

## 6. Normative Language Policy (RFC 2119/8174)

In standards-like sections, uppercase keywords MUST be used consistently:

- `MUST` / `MUST NOT`: absolute requirement/prohibition
- `SHOULD` / `SHOULD NOT`: strong recommendation
- `MAY`: optional behavior

Lowercase words (must/should/may) are treated as plain English and are non-normative.

Required boilerplate for normative sections:

> The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",  
> "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and  
> "OPTIONAL" in this document are to be interpreted as described in  
> BCP 14 [RFC2119] [RFC8174] when, and only when, they appear in all capitals.

---

## 7. Decision Log Standard (ADR/MADR + DEC-V2 Equivalent)

All significant architecture/product decisions MUST be documented as ADR entries or DEC-V2 entries that are explicitly ADR-equivalent.

ADR minimum structure:

- Title (`ADR-XXXX: ...`)
- Status (`Proposed`, `Accepted`, `Superseded`, `Deprecated`, `Rejected`)
- Context / Problem
- Decision Drivers
- Options Considered
- Decision Outcome
- Consequences (good/bad)
- Supersedes / Superseded by (when applicable)

DEC-V2 ADR-equivalent minimum structure (mandatory in `docs/20-architecture/decisions.md`):

- Title (`DEC-V2-XXX: ...`)
- Status (`Proposed`, `Accepted`, `Superseded`, `Deprecated`, `Rejected`)
- Context / Problem
- Decision Drivers
- Decision Outcome
- Consequences (good/bad)
- Supersedes / Superseded by (when applicable)

Rules:

- One ADR = one decision
- Accepted ADRs are immutable (except typo fixes)
- Revisions require a new superseding ADR
- DEC-V2 entries missing required fields are invalid and MUST fail documentation QA

---

## 7.1 Requirement ID Lineage Policy

Canonical ID namespaces:

- Product requirements: `FR-XX`, `NFR-XX`
- System requirements: `SR-FR-XXX`, `SR-NFR-XXX`

Mandatory lineage rules:

- Every `FR-*` and `NFR-*` MUST map to at least one `SR-*` requirement.
- Every `SR-*` requirement MUST map back to at least one source `FR-*` or `NFR-*`.
- Mapping MUST be explicitly published in `docs/30-analysis/step_03_system_requirements.md`.
- Any unmapped requirement ID MUST fail documentation QA.

---

## 8. Cross-Document Consistency Rules

Every active document MUST align with:

- `docs/20-architecture/canonical_framework.md` (terms/statuses)
- `docs/20-architecture/decisions.md` (decision authority)
- `docs/10-product/requirements.md` (scope and requirement baseline)
- flow documents (runtime behavior)

Hard consistency checks:

1. No conflicting status models across files
2. No scope contradictions (`In Scope` vs `Out of Scope`)
3. No active assumption of global cross-leader marketplace browsing
4. Tenant boundary language is explicit in domain/flow/technical docs

---

## 9. Quality Gates Before Build

The documentation set passes only if all checks are true:

- Completeness: mandatory document set exists
- Correctness: no internal contradiction
- Traceability: archive-to-v2 mapping remains explicit
- Testability: requirements have acceptance criteria
- Implementability: technical spec supports MVP scope
- Governance: key decisions captured as ADR entries

---

## 10. Operating Workflow (How to Use This Standard)

1. Update or add source analysis
2. Draft changes in relevant v2 document
3. Validate against canonical framework
4. Add/update ADR if decision changed
5. Recheck traceability matrix
6. Run consistency review
7. Mark document version/date

---

## 11. Document Control

- Version: `v1`
- Status: `Active`
- Language: `English-only`
- Owner: Product/Architecture documentation stream

This document is the default standard for all future documentation work.
