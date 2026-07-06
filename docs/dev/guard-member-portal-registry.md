# Guard Specification — Member Portal Shell

**Status:** **ACTIVE** — `guard-member-portal-registry.mjs` implemented (PS-2).

**Authority:** [platform-portal-member-shell-architecture.mdoc](../phase-19/platform-portal-member-shell-architecture.mdoc) · [implementation-gates.mdoc](../phase-19/member-portal-shell/implementation-gates.mdoc)

---

## Guard index

| Guard | Script target | CI stage | Severity | Owner | Phase |
| ----- | ------------- | -------- | -------- | ----- | ----- |
| `guard-member-portal-registry` | `scripts/guards/guard-member-portal-registry.mjs` | pre-commit / PR | **fail** | Platform | PS-2+ |
| `guard-member-portal-contract` | `scripts/guards/guard-member-portal-contract.mjs` | pre-commit / PR | **fail** | Platform | PS-2+ |
| `guard-no-workspace-ids-in-codegen` | `scripts/guards/guard-no-workspace-ids-in-codegen.mjs` | guest conformance bundle | **fail** | Platform | Phase B |
| `guard-member-module-id-reserved` | (sub-rule of registry guard) | pre-commit / PR | **fail** | Platform | PS-2+ |
| `guard-member-url-builder` | `scripts/guards/guard-member-url-builder.mjs` | PR | **fail** | Platform | PS-3+ |
| `guard-workspace-member-egress` | `scripts/guards/guard-workspace-member-egress.mjs` | PR | **fail** | Platform | PS-4+ |
| `guard-member-no-hardcoded-links` | (sub-rule of registry + egress) | PR | **fail** | Platform | PS-1+ |
| `guard-member-shell` | `scripts/guards/guard-member-shell.mjs` | PR | **fail** | Portal | PS-1+ |
| `guard-guest-cross-surface-nav` | `scripts/guards/guard-guest-cross-surface-nav.mjs` | PR | **fail** | Platform | PS-4+ |
| `guard-member-seo` | `scripts/guards/guard-member-seo.mjs` | PR | **fail** | Portal | PS-4+ |

**Existing guards (unchanged):** `guard-wrs-routing`, `guard-pcms-authority`, `guard-public-catalog-m17` (extended PS-5).

---

## 1. `guard-member-portal-registry`

| Field | Value |
| ----- | ----- |
| **Purpose** | Enforce manifest-driven member nav; registry codegen freshness |
| **Inputs** | Staged diff: `apps/portal/**`, `packages/workspaces/*/workspace.manifest.json`, generated registry output |
| **Failure conditions** | Hardcoded shell nav hrefs; manifest change without `generate:workspace-registry` diff; >5 primary modules; duplicate module ids |
| **CI stage** | `pre-commit:fast` (when implemented); required on Phase 2+ PRs |
| **Severity** | **fail** |
| **Owner** | Platform architecture |
| **DL** | DL-04, DL-34 |
| **Gate** | Phase 2 exit 2.1–2.3 |

---

## 1b. `guard-member-portal-contract`

| Field | Value |
| ----- | ----- |
| **Purpose** | Unified member portal contract — manifest `availability` ↔ generated `WORKSPACE_MEMBER_PORTAL_CONTRACTS` |
| **Inputs** | `packages/workspaces/*/workspace.manifest.json`, codegen output |
| **Failure conditions** | Stale registry; `memberApp: true` with `availability: off`; `memberApp: true` with `availability !== full`; L4 reference workspace drift; manifest ↔ generated contract mismatch |
| **CI stage** | `guard:guest-plugin-conformance` bundle; `guard:member-portal-shell` |
| **Severity** | **fail** |
| **Owner** | Platform architecture |
| **DL** | DL-07, DL-18 (superseded) |
| **Schema** | [member-portal-registry-schema.mdoc](../phase-19/member-portal-shell/member-portal-registry-schema.mdoc) |

---

## 2. `guard-member-module-id-reserved`

| Field | Value |
| ----- | ----- |
| **Purpose** | Block workspace declaration of platform-owned and namespace-reserved module ids (DL-30) |
| **Inputs** | `memberPortal.modules[].id` in workspace manifests |
| **Failure conditions** | Module id ∈ `{ home, more, api, catalog }` declared by workspace |
| **CI stage** | Same as registry guard |
| **Severity** | **fail** |
| **Owner** | Platform architecture |
| **DL** | DL-30 |
| **Note** | `home` is platform-owned — see RFC §4.3.1. `trips`, `profile`, `wallet` are workspace-declarable. |

**Platform-owned ids (workspace MUST NOT declare):**

| id | Route | Owner |
| -- | ----- | ----- |
| `home` | `/me/home` | Platform shell (BP-4) |

**Namespace-reserved (workspace MUST NOT declare):**

| id | Reason |
| -- | ------ |
| `more` | Shell hub slot |
| `api` | BFF namespace |
| `catalog` | Registration namespace |

---

## 3. `guard-member-url-builder`

| Field | Value |
| ----- | ----- |
| **Purpose** | Enforce [Builder Migration Contract](../phase-19/member-portal-shell/builder-migration-contract.mdoc) |
| **Inputs** | `packages/guest-surface-host/src/**`, consumer imports in apps/marketing |
| **Failure conditions** | Literal `/me/registrations` in GSH after PS-3 except alias tests; new imports of `resolvePortalMemberAreaUrl` after Cleanup Phase; independent path logic in deprecated builder |
| **CI stage** | PR touching GSH or marketing shell |
| **Severity** | **fail** (warn on deprecated import PS-3 through PS-6) |
| **Owner** | Platform routing |
| **DL** | DL-22, DL-26 |

---

## 4. `guard-workspace-member-egress`

| Field | Value |
| ----- | ----- |
| **Purpose** | Block hardcoded member paths in workspace registration flows (DL-38) |
| **Inputs** | `packages/workspaces/*/src/**/registration-flow/**` |
| **Failure conditions** | `href="/me/` or `` `/me/ `` string literals in step components |
| **CI stage** | PR touching workspace packages |
| **Severity** | **fail** |
| **Owner** | Workspace platform |
| **DL** | DL-38 |
| **Gate** | Phase 3 exit 3.3 |

---

## 5. `guard-member-no-hardcoded-links`

| Field | Value |
| ----- | ----- |
| **Purpose** | Aggregate rule — no hardcoded member URLs in portal shell and layout |
| **Inputs** | `apps/portal/app/me/layout.tsx`, shell components, `apps/portal/app/page.tsx` (post PS-5) |
| **Failure conditions** | Literal `/me/registrations` or `/me/profile` in shell nav outside registry/codegen allowlist |
| **CI stage** | PR touching portal shell |
| **Severity** | **fail** |
| **Owner** | Portal platform |
| **DL** | DL-04, DL-06 |
| **Gate** | Phase 1 exit (inline nav); Phase 2 exit (registry) |

---

## 6. `guard-member-shell`

| Field | Value |
| ----- | ----- |
| **Purpose** | Shell landmark and mode invariants (DL-01, DL-27) |
| **Inputs** | Portal layout/shell source; optional DOM snapshot tests |
| **Failure conditions** | Missing `[data-portal-shell]` on `/me/*`; bottom nav on `/catalog/*/register`; inline `<nav` with hardcoded member hrefs in `me/layout.tsx` after PS-1 |
| **CI stage** | PR + optional smoke hook scan |
| **Severity** | **fail** |
| **Owner** | Portal platform |
| **DL** | DL-01, DL-27 |
| **Gate** | Phase 1 exit 1.1–1.3 |

---

## 7. `guard-guest-cross-surface-nav`

| Field | Value |
| ----- | ----- |
| **Purpose** | Validate `guestCrossSurfaceNav` manifest against surface allowlist (DL-37) |
| **Inputs** | Workspace manifests; [guest-cross-surface-nav-schema.mdoc](../phase-19/member-portal-shell/guest-cross-surface-nav-schema.mdoc) rules |
| **Failure conditions** | Club-visible link to platform-mother-only path; portal path in marketing nav; absolute URLs |
| **CI stage** | PR touching manifest or marketing shell |
| **Severity** | **fail** |
| **Owner** | Platform routing |
| **DL** | DL-05, DL-37 |

---

## 8. `guard-member-seo`

| Field | Value |
| ----- | ----- |
| **Purpose** | Portal crawl boundary (DL-39) |
| **Inputs** | `apps/portal/app/robots.ts`, route metadata |
| **Failure conditions** | Missing noindex for `/me/*`; missing noindex for `/catalog/*/register`; missing `/api/` disallow |
| **CI stage** | PR touching portal SEO |
| **Severity** | **fail** |
| **Owner** | Portal platform |
| **DL** | DL-39 |
| **Gate** | Phase 3 exit 3.5 |

---

## 9. Rollout matrix

| Guard | Doc | Script | Blocks |
| ----- | --- | ------ | ------ |
| guard-member-shell | ✓ | **Implemented** (`guard-member-shell.mjs`) | Wrong shell mode |
| guard-member-no-hardcoded-links | ✓ | PS-1 impl | Inline nav |
| guard-member-portal-registry | ✓ | ✓ PS-2 | Hardcoded nav |
| guard-member-module-id-reserved | ✓ | ✓ PS-2 (codegen) | Invalid module id |
| guard-member-url-builder | ✓ | ✓ PS-3 | GSH hardcode |
| guard-guest-cross-surface-nav | ✓ | ✓ PS-4 | 404 nav links |
| guard-workspace-member-egress | ✓ | ✓ PS-4 | Workspace hrefs |
| guard-member-seo | ✓ | ✓ PS-4 | Crawl leak |

---

## 10. Verification commands (when implemented)

```bash
pnpm run pre-commit:fast && pnpm run guard:import-boundary
pnpm run guard:wrs-routing
pnpm run guard:pcms-authority
# Future:
# pnpm run guard:member-portal-registry
# pnpm run guard:member-url-builder
# pnpm run guard:workspace-member-egress
# pnpm run guard:member-shell
# pnpm run guard:guest-cross-surface-nav
# pnpm run guard:member-seo
```

---

*Guard spec v2.0.0 · PENDING SIGN-OFF · Documentation only*
