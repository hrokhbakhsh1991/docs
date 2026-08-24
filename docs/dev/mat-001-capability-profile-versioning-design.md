# MAT-001 — Capability / profile versioning design (M1 design-only)

**Program:** Enterprise Maturity MAT-M1  
**Status:** DESIGN ONLY — no runtime migration in M1  
**Date:** 2026-08-24  
**Verdict:** **READY_FOR_IMPLEMENTATION** (M2 scope)

---

## 1. Problem

Workspaces today bind **implicit latest** manifest + profile composition. Additive changes are safe; breaking capability or profile defaults risk cross-tenant drift without a version pin.

Goal: **Workspace A → capability v1, Workspace B → capability v2** without cloning implementation packages.

---

## 2. Version model (minimal)

### 2.1 Version axes

| Artifact | Version field | Semantics |
|----------|---------------|-----------|
| Workspace manifest | `manifest.version` (existing int) | Package release; bump on breaking manifest/codegen contract |
| Profile catalog entry | `profileVersion` (new, int) | Monotonic per `profileId`; immutable once tenants pin |
| Capability block | `capabilityRevision` (new, optional int per block) | Increment on breaking validator/field contract for that capability |
| Generated bindings | Content hash / `registryGeneration` (existing codegen banner) | Build artifact identity |

**No semver triple** for capabilities — integer revision + manifest version is sufficient.

### 2.2 Pinning

```json
{
  "workspaceTypes": ["denali"],
  "profilePin": { "id": "starter-outdoor", "profileVersion": 2 },
  "capabilityPins": {
    "workspaceTransport": { "revision": 1 }
  }
}
```

- **Tenant/workspace binding** stores pin at provision time (extends `tenant_workspaces` metadata).
- **Unpinned** workspaces resolve **latest compatible** profile + capability revisions at codegen registry load (today's behavior).

---

## 3. Design questions (explicit answers)

### Q1. Can existing workspaces remain pinned?

**Yes.** Default for enterprise tenants: pin at onboarding. Dev tenants may float to latest. Pin stored in tenant workspace metadata; effective manifest = `resolveEffectiveManifest(pin)`.

### Q2. Profile: snapshot-at-create or live inheritance?

**Hybrid (recommended):**

- **Snapshot-at-create** for `capabilityDefaults` keys that affect runtime behavior (booking, finance, equipment flags).
- **Live inheritance** for non-breaking doc-only profile metadata (authoring guide links) when `profileVersion` unchanged.
- Breaking profile bump → new `profileVersion`; unpinned tenants opt-in via migration job; pinned tenants stay on old version until explicit upgrade.

### Q3. Breaking capability versions?

Represent as **`capabilityRevision` increment** on the manifest block + validator/field contract changelog. Breaking = removed field path, stricter validator, or removed manifest flag. Non-breaking = additive flag defaulting false.

### Q4. Codegen version resolution?

```
effectiveCapabilityRevision(capId, workspaceType, pin) =
  pin.capabilityPins[capId]?.revision
  ?? manifest[capId].capabilityRevision
  ?? 1

codegen emits dispatch tables keyed by (workspaceType, revision) only when >1 revision active in registry.
```

Single revision: current generated files unchanged. Multiple revisions: `workspace-{cap}-capabilities.v{N}.generated.ts` + resolver.

### Q5. Two workspaces, different versions concurrently?

**Yes.** `denali` tenant A pinned transport v1, tenant B on v2 — same `workspaceType`, different effective capability revision via tenant pin (not package fork).

### Q6. Rollback?

1. **Config rollback:** revert pin to previous `profileVersion` / `capabilityRevision`.
2. **Deploy rollback:** deployment stamp (MAT-010) restores prior registry generation hash.
3. **Data:** no automatic down-migration — forward-only migrations with compat readers (deprecation policy).

### Q7. Data migration ownership?

| Layer | Owner |
|-------|-------|
| Tour canonical shape changes | Workspace adapter + host migration script |
| Booking/finance rows | `apps/api` Prisma migrations + workspace adapter |
| Profile default changes | Profile author + codegen; optional backfill job per tenant |
| Capability validator tightening | Workspace package; may require tour re-save |

Platform-core / tour-core **never** own workspace semantic migrations.

### Q8. Capability disabled after data exists?

- **Disable flag:** new writes reject optional fields; existing canonical data **remains readable** (egress may hide).
- **Hard removal:** REMOVAL_SCHEDULED per deprecation policy; migration strips or archives fields.
- Validators: absent capability → no-op (M1 MAT-002 pattern); policy stage may warn on publish.

---

## 4. Staged upgrade flow (M2 target)

```text
1. Ship capabilityRevision N+1 beside N (codegen dual dispatch)
2. Mark N DEPRECATED in deprecation policy
3. Tenant upgrade wizard: bump pin → run preflight validator
4. Optional backfill job for canonical documents
5. After census zero on N → remove dispatch row
```

---

## 5. Dependencies

- MAT-002 real validators (M1) — **done**
- MAT-010 deployment stamps (M3) — per-tenant bundle freeze
- MAT-014 deprecation policy (M1) — **done**

---

## 6. Verdict

**READY_FOR_IMPLEMENTATION** in MAT-M2 with:

- Schema: `profileVersion`, `capabilityRevision`, tenant pin metadata
- Codegen: revision-aware resolver (only when multiple revisions coexist)
- No migration runtime in M1

*Architect, documentation status: Updated. Link to docs: `docs/dev/mat-001-capability-profile-versioning-design.md`.*
