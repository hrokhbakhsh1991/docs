# Deprecation policy (MAT-014)

**Program:** Enterprise Maturity MAT-M1  
**Status:** ACTIVE  
**Date:** 2026-08-24  
**Scope:** Package APIs, capability contracts, manifest fields, profile fields, generated bindings, compatibility re-exports, database-facing contract changes.

This policy is **evidence-based and release-count-based** — not calendar SLA fiction. Removals require proof, not elapsed time alone.

---

## 1. Lifecycle states

| State | Meaning | Consumer obligation |
|-------|---------|---------------------|
| **ACTIVE** | Supported; default for new work | Use as documented |
| **DEPRECATED** | Still works; replacement documented | Migrate on next touch or bounded window |
| **REMOVAL_SCHEDULED** | Removal PR identified; census complete | Must migrate before removal merge |
| **REMOVED** | No longer available | Upgrade or pin older bundle |

Transitions require **Architect approval** for breaking manifest/codegen contract changes.

---

## 2. Deprecation annotation requirements

Every deprecation MUST record:

1. **Annotation** — `@deprecated` JSDoc (TS), `deprecated: true` in manifest schema comment, or ledger row in `docs/dev/enterprise-maturity-plan.md`.
2. **Replacement path** — exact successor symbol, manifest key, or capability block.
3. **Consumer census** — `rg`/codegen audit listing importers; attach to removal PR.
4. **Compatibility window** — minimum **one platform release** with DEPRECATED state before REMOVAL_SCHEDULED, OR explicit Architect waiver with external customer evidence.
5. **Removal evidence** — green guards + `test:changed` + affected workspace parity specs.
6. **Rollback** — revert commit or re-export shim for one release if production regression.

---

## 3. Surface-specific rules

### 3.1 Package / SDK APIs

- Add `@deprecated` with `Use X instead` in the same release that introduces the replacement.
- Keep deprecated export until REMOVAL_SCHEDULED census shows zero non-test imports (guard-enforced where listed in allowlist).

### 3.2 Capability contracts (`workspace*` manifest blocks)

- New surfaces ship behind capability flags; do not remove flags without REMOVAL_SCHEDULED.
- Deprecated manifest keys (e.g. `catalogRegistrationFlow.transportInitializerExport` → `workspaceTransport.registrationInitializer`) remain readable via compat layer until census zero.

### 3.3 Profile fields (`capabilityDefaults`)

- Profile overrides are **additive** by default; removing a default requires profile version design (MAT-001) before REMOVAL_SCHEDULED.

### 3.4 Generated bindings

- Never hand-edit `*.generated.ts`; deprecate the **manifest source** and regenerate.
- Generated re-exports may keep deprecated aliases one release when codegen emits both.

### 3.5 Database / Prisma

- Follow `docs/phase-0-foundation.md` migration discipline: expand → migrate → contract.
- Column/table removal requires REMOVAL_SCHEDULED + backup evidence (production closure ledger).

---

## 4. CI / guard enforcement

| Guard | What it enforces |
|-------|------------------|
| `pnpm run guard:deprecation-policy` | Policy doc present; known deprecated manifest aliases listed in allowlist |
| `scripts/guard-docs.sh` (pre-commit) | Doc-first for protected packages |
| `pnpm run generate:workspace-registry --check` | Generated bindings match manifests |

**Not enforced in M1:** automated `@deprecated` import scanner (future MAT-014 follow-up when census tooling lands).

---

## 5. Known deprecated aliases (initial allowlist)

| Deprecated | Replacement | Owner | State |
|------------|-------------|-------|-------|
| `catalogRegistrationFlow.transportInitializerExport` | `workspaceTransport.registrationInitializer` | CW7-05 | DEPRECATED (compat reader) |
| Top-level `equipmentIconKeyValidator` (legacy manifests) | `workspaceEquipment.iconKeyValidator` | CW7-02 | DEPRECATED |

No mass-deprecation in M1 — table grows only with evidence.

---

## 6. Rollback

- **DEPRECATED → ACTIVE:** revert deprecation annotation if replacement not ready.
- **REMOVAL_SCHEDULED → DEPRECATED:** restore shim export + regenerate bindings.
- **REMOVED:** git revert removal commit; redeploy prior deployment stamp (MAT-010, M3).

*Architect, documentation status: Updated. Link to docs: `docs/standards/deprecation-policy.md`.*
