# CW6-02 — Profile expansion codegen (implementation)

**Verdict:** Implementation  
**Ledger task:** CW6-02  
**Status:** Codegen-time profile expansion before registry emission  
**Prepared:** 2026-08-23  
**Design contract:** [`cw6-01-starter-profile-contract.md`](cw6-01-starter-profile-contract.md)

---

## 1. Scope

| Deliverable | Location |
| ----------- | -------- |
| Platform profile catalog | `profiles/*.profile.json` |
| Expansion domain | `scripts/codegen/workspace-registry/domains/profile-expansion.mjs` |
| Effective manifest input | `manifest-loader.mjs` → `applyProfileExpansion` before domains |
| Audit artifact | `packages/workspace-sdk/src/manifest/workspace-profile-expansion-audit.generated.ts` |
| Schema | `manifest.schema.ts` — optional `profile` string ref |

**Out of scope:** CW6-03 `starter-outdoor` workspace adoption, CW6-04 scaffold, runtime expansion.

---

## 2. Expansion algorithm

```text
author manifest → resolve profiles/<id>.profile.json
               → deepMerge(capabilityDefaults, author) — author wins leaves
               → strip profile key
               → domain codegen reads effective manifest
```

Merge rules: recursive object merge; arrays replaced entirely; `PROFILE_NOT_FOUND` / `PROFILE_CHAIN_FORBIDDEN` fail codegen.

---

## 3. Determinism

- Profile catalog enumeration sorted by id
- Merge traversal uses sorted object keys
- `pnpm run generate:workspace-registry --check` compares audit + downstream `*.generated.ts` byte-identically

---

## 4. Tests

| Spec | Coverage |
| ---- | -------- |
| `scripts/test/profile-expansion-merge.spec.mjs` | merge precedence, audit paths, catalog resolve, missing profile |

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw6-02-profile-expansion-codegen.md`.*
