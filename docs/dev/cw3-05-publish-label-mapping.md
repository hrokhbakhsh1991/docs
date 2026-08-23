# CW3-05 — Neutral publish-label mapping contract

**Ledger task:** CW3-05  
**Wave:** CW Wave 3B  
**Status:** **COMPLETE**  
**Evidence:** TRUTH §2, §5; FEAS Step 2; DEC-CW-02 Option B (approved)  
**Downstream:** CW3-06 replaces `isPublishedPublishStatusLabel` heuristics with dispatch + this mapping

---

## 1. Problem

Host lifecycle code (`assert-tour-publish-lifecycle-gate.ts`) bridges workspace canonical **wire labels** (`active`, `published`, `archived`) to plugin `WorkspaceLifecycleContract` states (`DRAFT`/`OPEN`, `DRAFT`/`PUBLISHED`) via a hard-coded heuristic:

```typescript
return label === "published" || label === "active";
```

CW-3 exit requires manifest-declared mapping: each workspace keeps its vocabulary; host consumes neutral buckets without global rename.

**CW3-05 scope:** types, manifest wire table, codegen bindings, dispatch — **no** consumer migration (CW3-06).

---

## 2. Neutral buckets (`TourPublishVisibilityBucket`)

| Bucket | Maps to lifecycle | Meaning |
|--------|-------------------|---------|
| `published` | `lifecycle.publishStatus` | Tour is in the workspace “open / published” lifecycle state |
| `notPublished` | `lifecycle.initialStatus` | Draft, archived (Urban), or any non-visible terminal label |

There is **no** global `ARCHIVED` lifecycle enum (DEC-CW-02 Option B). Archive wire labels map to `notPublished` via optional capability metadata.

---

## 3. Manifest shape (`canonicalTour.publishLabelMapping`)

Wire-only JSON — no runtime adapter:

```jsonc
{
  "canonicalTour": {
    "publishLabelMapping": {
      "publishedLabels": ["active"],
      "notPublishedLabels": ["draft"],
      "archiveCapability": false
    }
  }
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `publishedLabels` | Yes | Canonical strings that resolve to `lifecycle.publishStatus` |
| `notPublishedLabels` | Yes | Canonical strings that resolve to `lifecycle.initialStatus` |
| `archiveCapability` | No (default false) | When `true`, workspace declares optional archive product extension (Urban today) |
| `optionalArchiveLabels` | When `archiveCapability` | Wire labels mapped through archive capability semantics → `notPublished` bucket |

**Codegen rules:**

1. Required for publish-golden workspaces with `canonicalTour` + `tourWrite`: `denali`, `urban`, `harbor`.
2. `publishedLabels` ∩ `notPublishedLabels` = ∅.
3. `optionalArchiveLabels` allowed only when `archiveCapability === true`.
4. Workspaces without archive must not declare `archiveCapability` or `optionalArchiveLabels`.

---

## 4. Per-workspace tables (preserved vocabulary)

| Workspace | `publishedLabels` | `notPublishedLabels` | Archive |
|-----------|-------------------|----------------------|---------|
| Denali | `active` | `draft` | none |
| Urban | `published` | `draft`, `archived` | `archiveCapability: true`, `optionalArchiveLabels: ["archived"]` |
| Harbor | `published` | `draft` | none |
| Starter | — | — | no `canonicalTour` binding (plugin lifecycle `DRAFT`/`OPEN` only) |

Urban `archived` → `notPublished` placeholder until optional `workspaceTourArchive` capability ships (DEC-CW-02).

---

## 5. SDK contract (`tour-publish-label-mapping.contract.ts`)

- `TourPublishVisibilityBucket` — `"published" \| "notPublished"`
- `WorkspacePublishLabelMapping` — manifest table type
- `mapPublishLabelToVisibilityBucket(label, mapping)` — exhaustive for declared labels; `undefined` for missing/unknown (fail-closed)
- `resolveLifecycleStatusFromVisibilityBucket(bucket, lifecycle)` — returns `publishStatus` or `initialStatus`

---

## 6. Codegen + dispatch

| Artifact | Path |
|----------|------|
| Generator | `scripts/codegen/workspace-registry/domains/tour-api.mjs` → `generatePublishLabelMappings` |
| Bindings | `apps/api/src/canonical/workspace-publish-label-mappings.generated.ts` |
| Dispatch | `apps/api/src/canonical/workspace-publish-label-mapping-dispatch.ts` |

Dispatch functions (CW3-06 consumers):

- `mapTourPublishStatusLabelToBucket(workspaceType, label)`
- `resolveTourPublishLifecycleStatusFromLabel({ workspaceType, lifecycle, label })`

Unknown workspace or unknown label → `undefined` (fail-closed).

---

## 7. Dependency direction

Same as CW3-01 visibility port: `apps/*` → dispatch → generated bindings → manifest JSON. Workspaces do not import mapping dispatch.

---

## 8. Verification

| Check | Command / spec |
|-------|----------------|
| Mapping exhaustive + fail-closed | `packages/workspace-sdk/test/tour-publish-label-mapping.contract.spec.ts` |
| Per-workspace dispatch | `apps/api/test/workspace-publish-label-mapping-dispatch.spec.ts` |
| CW0-02 parity (unchanged) | `test/parity/publish-transition.golden.spec.mjs` |
| Registry | `pnpm run generate:workspace-registry --check` |

---

## 9. Non-goals (CW3-06)

- Replace `isPublishedPublishStatusLabel` in `assert-tour-publish-lifecycle-gate.ts`
- Migrate `resolve-validation-mode.ts` heuristic
- Add `ARCHIVED` to `WorkspaceLifecycleContract`

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw3-05-publish-label-mapping.md`.*
