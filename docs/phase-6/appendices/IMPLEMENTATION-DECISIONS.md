# Phase 6 — Implementation decisions (agent SoT)

```yaml
decision_doc_version: "2026-06-04-v1"
extends_pek: docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md
legacy_port_source: legacy/packages/denali-domain/
reference_workspace: packages/workspaces/starter/
```

> Resolves ambiguities before Denali code. **If conflict, this file wins** for Phase 6.

---

## DEC-P6-001 — platform-core unchanged

```yaml
rule: "If Phase 6 needs a platform-core PR, Phases 1–5 failed"
allowed_in_platform_core:
  - "Generic types already supporting composite + uiHints (Phase 1)"
  - "Optional export surface docs — no Denali-specific branches"
forbidden:
  - "if (workspaceType === 'denali') in platform-core"
  - "DENALI_* field kinds hard-coded in core registry"
source: docs/phase-1/appendices/denali-phase-6.md
```

---

## DEC-P6-002 — Package layout (`packages/workspaces/denali`)

Replace probe package with real workspace layout (mirror starter):

```text
packages/workspaces/denali/
  package.json          # @app-tour/workspace-denali
  src/
    index.ts            # export getDenaliWorkspacePlugin, theme path
    denali.plugin.ts    # WorkspacePlugin implementation
    field-registry/     # ported from legacy domain
    composites/         # widget registry
  theme/
    tokens.css          # workspace ingress — Phase 2 contract
  test/
    *.contract.spec.ts
    phase-6.contract.spec.ts
```

**Today:** only `DENALI_BREACH_PROBE` — see [`denali/README.md`](../../../packages/workspaces/denali/README.md).

---

## DEC-P6-003 — Plugin registry (api + web)

| App | Today                                                      | Target 6.5                                       |
| --- | ---------------------------------------------------------- | ------------------------------------------------ |
| API | `resolveWorkspacePluginForType("denali")` throws NOT_BOUND | Register `denali` → `getDenaliWorkspacePlugin()` |
| Web | `workspace-plugin-registry.ts` starter only                | Lazy/dynamic import of denali plugin module      |

**Pattern:** Copy [`apps/api/src/workspace/resolve-workspace-plugin.ts`](../../../apps/api/src/workspace/resolve-workspace-plugin.ts) switch — **no** `getStarterWorkspacePlugin()` fallback when tenant is denali.

**SDK:** `resolveWorkspacePluginIdForType("denali")` must return `"denali"` (update workspace-sdk binding tests).

---

## DEC-P6-004 — Validation & canonical (Phase 5 carryover)

- Denali uses same `CanonicalTourService` + `validateCanonical` pipeline (Phase 5.2).
- Denali field rules live in **plugin** `fieldRegistry` / rules — not API DTO strips.
- Projection extension: add Denali paths to `projection_derivation_map` **addendum** in schema doc — **after** starter base (Phase 5 §5 `extension_phase_6`).

---

## DEC-P6-005 — Events & finance (6.4)

| Concern        | Decision                                                                          |
| -------------- | --------------------------------------------------------------------------------- |
| TourCreated    | Already via Phase 5 outbox — Denali handlers **subscribe** in plugin              |
| Finance ledger | Port legacy finance hooks into **plugin** package; consume outbox / domain events |
| Core API       | **No** new finance tables in `apps/api` generic layer                             |

Reference: `legacy/.../emit-finance-ledger-journal-outbox` — port pattern, not Nest module copy into `apps/api`.

---

## DEC-P6-006 — MinIO photos (6.7)

| Item    | Decision                                                               |
| ------- | ---------------------------------------------------------------------- |
| Storage | MinIO per MAP §5 — **not** in Phase 5                                  |
| Config  | Document in `env-runtime-matrix` — reuse legacy env names where stable |
| Test    | HTTP e2e upload + read — tenant-scoped keys                            |

**Forbidden:** Photo pipeline in `platform-core` or generic `apps/api` without plugin boundary.

---

## DEC-P6-007 — migrateCanonical (6.8)

- Phase 5: hook design only [`migrate-canonical-hook.ts`](../../../apps/api/src/canonical/migrate-canonical-hook.ts)
- Phase 6: **execute** migration for legacy `trip_details` → `canonical_data` for **empty or controlled** tenants first
- **No** dual-write SoT — MAP forbidden

---

## DEC-P6-008 — Legacy import boundary

```yaml
allowed:
  - "Manual port/copy from legacy into packages/workspaces/denali"
  - "Read legacy for parity tests"
forbidden:
  - "import from 'legacy/' in apps/api or apps/web runtime code"
  - "depcruise allow legacy → trunk product"
```

---

## DEC-P6-009 — Verification ladder

| Layer                                                | Proves                                      |
| ---------------------------------------------------- | ------------------------------------------- |
| `packages/workspaces/denali/test/*.contract.spec.ts` | Plugin surface                              |
| `phase-6.contract.spec.ts`                           | MAP §12 contractual gate                    |
| HTTP smoke                                           | 6.6 — wizard paths                          |
| MinIO e2e                                            | 6.7                                         |
| `phase-6:gate`                                       | build + test + phase-5:gate + phase-6:guard |

**Not sufficient:** build green alone (MAP hardening filter).

---

## DEC-P6-010 — Subphase order

```text
6.0 → 6.1 → 6.2 → {6.3 ∥ 6.4} → 6.5 → {6.6 ∥ 6.7} → 6.8 → 6.9
```

6.5 blocks on 6.2 (plugin definition exists). 6.8 after bootstrap + smoke.

---

## Industry alignment

| Pattern             | Phase 6 use                                                                       |
| ------------------- | --------------------------------------------------------------------------------- |
| Plugin architecture | Workspace isolation — Shopify/WordPress-style extensions in bounded package       |
| Strangler fig port  | legacy denali-domain → denali workspace without big-bang                          |
| Contract tests      | Consumer-driven plugin API — same discipline as Phase 5 scaffold/behavioral split |

See [`industry-alignment-2026.md`](industry-alignment-2026.md).
