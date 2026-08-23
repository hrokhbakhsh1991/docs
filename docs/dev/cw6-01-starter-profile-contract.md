# CW6-01 — Starter Profile manifest contract (design)

**Verdict:** **PASS**  
**Ledger task:** CW6-01  
**Status:** Design contract frozen — **no expansion implementation** (CW6-02+)  
**Prepared:** 2026-08-23 (Wave 6A)  
**Deps satisfied:** CW5-11 tour-core certification  

**Mandatory inputs (not re-audited):**

- `docs/dev/composable-workspace-refactor-plan.md` — CW-6 phase, CW6-03 `starter-outdoor` target
- `.architecture-analysis/COMPOSABLE-WORKSPACE-ARCHITECTURE-AUDIT.md` (AUDIT) §12 Phase 2
- `.architecture-analysis/SHARED-TOUR-CORE-EXTRACTION-FEASIBILITY.md` (FEAS) Step 8
- `packages/workspace-sdk/src/manifest.schema.ts` — strict core + `.passthrough()` extension blocks
- `packages/workspaces/starter/workspace.manifest.json` — minimal workspace reference

---

## 1. Executive summary

A **profile** is a **named, platform-owned composition preset**: a deterministic bundle of manifest capability blocks and defaults that codegen expands **before** registry emission. It is **not** inheritance, **not** a base workspace class, and **not** runtime magic.

**Binding syntax:** singular manifest reference `profile: "<id>"` (string slug). Reject `extends`, `profiles` (plural in workspace manifest), and profile-on-profile chains in v1.

Workspace manifests retain full override authority through explicit keys at supported seams. Expanded configuration is **inspectable** via generated expansion artifacts.

---

## 2. Non-goals (profile MUST NOT)

| Forbidden | Rationale |
|-----------|-----------|
| Clone Denali modules or field registries | FEAS §6; TRUTH semantic divergence |
| Become a workspace superclass / OOP inheritance | Composition preset only |
| Hide expanded blocks from codegen audit | Inspectability invariant |
| Runtime profile resolution or lazy merge | Codegen-time only |
| Prevent workspace overrides at manifest seams | Overrides are explicit |
| Collide with deploy-profile (`WORKSPACE_DEPLOY_PROFILE`) | Different concern — build filter vs composition |

---

## 3. Syntax choice — `profile` vs `extends` vs `profiles`

| Candidate | Verdict | Reason |
|-----------|---------|--------|
| `profile: "starter-outdoor"` | **SELECT** | Matches existing singular refs (`memberPortal.preset`, `guestLanding.variant`); no inheritance semantics |
| `extends: "starter-outdoor"` | **REJECT** | Implies subclassing / override inheritance |
| `profiles: ["a","b"]` | **REJECT v1** | Ordering + conflict surface unnecessary; compose in profile definition instead |
| `profile: { ref, version }` | **OPTIONAL v1.1** | v1 allows plain string; optional pin `profileVersion` on workspace manifest later |

---

## 4. Profile definition registry (platform-owned)

Profiles are **not** embedded inline in each workspace manifest. They live in a coordinator-owned catalog:

```text
profiles/
  starter-outdoor.profile.json      # v1 catalog entry
  _schema.profile-manifest.json     # Zod/JSON schema for profile files (CW6-02)
```

**Ownership:** platform (`packages/workspace-sdk` or `scripts/codegen/workspace-registry/profiles/` — coordinator chooses at CW6-02 integration). Workspaces **reference** by id; they do not author profile bodies unless explicitly promoted to platform catalog via PR.

### 4.1 Profile file shape (proposed)

```json
{
  "id": "starter-outdoor",
  "version": 1,
  "description": "Outdoor club preset — booking + finance + registration-flow + catalog presentation + member profile",
  "capabilityDefaults": {
    "workspaceBooking": { "supported": true, "defaultModuleEnabledWhenUnset": true },
    "workspaceFinance": { "supported": true, "defaultModuleEnabledWhenUnset": true },
    "catalogRegistrationFlow": { "steps": { "mode": "shared" } },
    "catalogPresentation": {
      "listFeatures": { "cityFilter": false },
      "detailSections": { "difficulty": true, "fitness": true, "itinerary": true, "policies": true }
    },
    "memberProfile": {
      "editableFields": ["displayName", "email"],
      "readOnlyFields": ["mobile"],
      "mobileChangeViaOtp": true
    },
    "tenantBrandingDefaults": {
      "primaryColor": "#2563eb"
    }
  }
}
```

**Invariant:** `capabilityDefaults` keys must be **known manifest extension blocks** already consumed by workspace-registry codegen domains (same keys as `workspaceBooking`, `catalogPresentation`, etc.). Profile files must **not** introduce new top-level keys without a codegen domain owner.

### 4.2 Workspace manifest reference

```json
{
  "id": "cert-club",
  "version": 1,
  "package": "@app-tour/workspace-cert-club",
  "workspaceTypes": ["cert-club"],
  "profile": "starter-outdoor",
  "plugin": { "entry": ".", "export": "getWorkspacePlugin" },
  "tenantBrandingDefaults": {
    "primaryColor": "#0d9488"
  }
}
```

After expansion (conceptual): `tenantBrandingDefaults.primaryColor` remains `#0d9488`; profile default `#2563eb` is overridden.

---

## 5. Expansion order (codegen-time, deterministic)

```text
1. Load workspace.manifest.json (author manifest)
2. If profile absent → author manifest is effective manifest (no-op path)
3. If profile present:
   a. Resolve profile id → profiles/<id>.profile.json (fail if missing)
   b. Validate profile file against profile schema
   c. Start effectiveManifest = deepClone(profile.capabilityDefaults)
   d. deepMerge(effectiveManifest, authorManifest) with author winning at leaves
   e. Strip `profile` key from effective manifest (resolved reference not persisted in effective output)
4. Run WorkspaceManifestCiSchema + assertWorkspaceManifestSemantics on effective manifest
5. Emit codegen from effective manifest (not raw author manifest)
6. Emit expansion audit artifacts (§7)
```

**Ordering guarantee:** profile defaults applied first; workspace manifest applied second. No third stage in v1.

---

## 6. Override precedence and merge rules

| Layer | Precedence |
|-------|------------|
| Workspace manifest (author) | **Highest** — wins leaf conflicts |
| Profile `capabilityDefaults` | Middle |
| Workspace package built-in plugin defaults | Lowest — unchanged; profile does not replace runtime plugin assembly |

### 6.1 Deep-merge algorithm (binding for CW6-02)

- **Objects:** recursive merge; author leaf replaces profile leaf.
- **Arrays:** author array **replaces** profile array entirely (no element-wise merge) — matches JSON manifest authoring expectations for `workspaceTypes`, `settingsEnrichers`, etc.
- **Scalars:** author wins.
- **`null` in author:** explicit null is author intent; replaces profile value (codegen must document per-block null semantics).

### 6.2 Conflict behavior

| Situation | Behavior |
|-----------|----------|
| Same scalar path, different values | **Allowed** — author wins; audit records override |
| Author adds block absent in profile | **Allowed** — additive |
| Profile block removed by author (`supported: false` etc.) | **Allowed** — author manifest is authoritative |
| Unknown profile id | **Codegen fail** (`PROFILE_NOT_FOUND`) |
| Profile references another profile | **Codegen fail v1** (`PROFILE_CHAIN_FORBIDDEN`) |
| Expanded manifest fails Zod/semantics | **Codegen fail** with path from effective manifest |
| Author manifest sets `profile` + duplicates entire profile block identically | **Allowed** — wasteful; audit warns (`PROFILE_REDUNDANT_OVERRIDE`) |

**No silent coercion:** codegen must not “pick winner” heuristically beyond the merge rules above.

---

## 7. Validation (static, at codegen)

1. **Profile catalog validation** — every `profiles/*.profile.json` valid; ids unique.
2. **Reference validation** — every workspace `profile` string resolves.
3. **Effective manifest validation** — `validateWorkspaceManifestCi` + semantics on merged result.
4. **Capability closure** — expanded manifest must not declare capability modules without required `package`/`module` bindings (existing domain guards).
5. **Determinism check** — `generate-workspace-registry.mjs --check` twice → byte-identical expansion artifacts.

Runtime API servers do **not** re-expand profiles; they consume generated registry rows derived from effective manifests.

---

## 8. Codegen output (CW6-02 targets)

| Artifact | Purpose |
|----------|---------|
| `profiles/<id>.profile.expanded.snapshot.json` (per workspace) | Human-inspectable effective manifest |
| `packages/workspace-sdk/src/manifest/workspace-profile-expansion-audit.generated.ts` | Override map: `workspaceId → { profileId, overriddenPaths[] }` |
| Existing domain `*.generated.ts` rows | Sourced from **effective** manifest, not raw author JSON |

**Barrel policy:** coordinator-owned; workers add domain outputs only through orchestrator domain modules.

---

## 9. Deterministic representation

- JSON snapshots: stable key sort (`json-stable-stringify` or existing codegen sorter).
- Merge traversal: sorted object keys at each depth.
- Profile catalog enumeration: sorted by `id`.
- Expansion audit: sorted `overriddenPaths`.

---

## 10. Versioning implications

| Field | Role |
|-------|------|
| `profile.version` in profile file | Catalog entry schema generation; bump on breaking default changes |
| `profile` on workspace manifest | Reference only |
| Optional future `profileVersionPin` | Workspace pins catalog version; unresolved pin → codegen fail |

**Compatibility:** changing profile defaults is a **platform semver** concern for workspaces that rely on profile without overrides. Changelog entry required per profile version bump.

---

## 11. Mapping to CW6-03 `starter-outdoor`

Target profile composes **existing RC capabilities by contract** (not Denali copies):

- `workspaceBooking` (booking-ws2 pattern)
- `workspaceFinance` (finance-ws pattern)
- `catalogRegistrationFlow` shared steps
- `catalogPresentation` outdoor-oriented gates
- `memberProfile` reduced field set

Does **not** include: Denali equipment registry, transport dong rules, publish-readiness matrix, IRR/toman unless workspace adds `catalogPresentation.priceDisplay` override.

---

## 12. Tests required (CW6-02+)

| Test | Scope |
|------|-------|
| `profile-expansion-merge.spec.mjs` | merge precedence: scalar, array replace, nested object |
| `profile-expansion-negative.spec.mjs` | missing profile, profile chain, invalid effective manifest |
| `profile-expansion-determinism.spec.mjs` | `--check` byte stability |
| `starter-outdoor-profile.spec.mjs` | CW6-03 — expected capability keys after expansion |
| `profile-certification.spec.ts` | CW6-06 — manifest → exact capability set |
| Extend `guard:workspace-registry-fresh` | expansion snapshots committed |

---

## 13. Shared files future implementation MUST touch (coordinator integration)

| File | Change |
|------|--------|
| `packages/workspace-sdk/src/manifest.schema.ts` | Optional `profile` string on strict core (or passthrough until promoted) |
| `scripts/generate-workspace-registry.mjs` | Orchestrator hook: expand profiles before domain sync |
| `scripts/codegen/workspace-registry/orchestrator.mjs` | Load effective manifests |
| `scripts/codegen/workspace-registry/domains/*.mjs` | Consume effective manifest input |
| `profiles/*.profile.json` | New catalog directory |
| `packages/workspace-sdk/src/manifest/workspace-profile-expansion-audit.generated.ts` | New generated audit |
| `scripts/workspace-create.mjs` | CW6-04 `--profile` scaffold |
| `docs/dev/workspace-registry-codegen-modularization.mdoc` | Domain index update |

**Workers A/B/C must not edit these concurrently** without coordinator merge.

---

## 14. CW6-01 closure checklist

| Item | Status |
|------|--------|
| Schema shape proposed | ✅ `profile` string + platform profile catalog |
| Expansion order defined | ✅ profile → author merge |
| Override precedence defined | ✅ author > profile |
| Conflict behavior defined | ✅ fail-fast + audit warnings |
| Validation defined | ✅ codegen static |
| Codegen output sketched | ✅ snapshots + audit |
| Deterministic representation | ✅ sorted merge |
| Profile ownership | ✅ platform catalog |
| Versioning implications | ✅ profile.version + optional pin |
| Implementation deferred | ✅ CW6-02+ |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw6-01-starter-profile-contract.md`.*
