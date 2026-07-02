# Plugin-First Migration — Task Breakdown (v4, maximum strictness / roadmap v6)

> **Authority:** roadmap v6. Every task has **DoR**, **DoD**, **Gate**, **PR type**.  
> **Total tasks:** ~85  
> **Rule:** Task cannot start until DoR satisfied. Task cannot close until DoD + gate slice satisfied.

---

## Task metadata legend

| Field | Meaning |
|-------|---------|
| **DoR** | Definition of Ready — must be true before coding |
| **DoD** | Definition of Done — must be true before merge |
| **Gate** | Phase gate IDs this task contributes to |
| **Type** | `codegen` \| `behavior` \| `guard` \| `doc` — **one per PR** |
| **Canary** | smoke required before merge |

---

# PHASE 0 — CODEGEN ONLY

## Epic PF-0.1 — Catalog paths

| ID | Task | Type | Gate | DoR | DoD | Canary |
|----|------|------|------|-----|-----|--------|
| 0.1.1 | Write extraction spec in generator | doc | G0.2 | — | spec reviewed | — |
| 0.1.2 | `extractCatalogPathsFromManifest` | codegen | G0.2 | 0.1.1 | unit test green | — |
| 0.1.3 | `generateWorkspaceCatalogPaths` | codegen | G0.2 | 0.1.2 | output matches hand map | — |
| 0.1.4 | `test-extract-catalog-paths.mjs` | guard | G0.2 | 0.1.2 | CI runnable | — |
| 0.1.5 | Cross-rule guestCatalog.enabled → routes | codegen | G0.2 | 0.1.2 | invalid manifest throws | — |

**PR-A scope:** 0.1.2–0.1.5 only. ≤15 files.

## Epic PF-0.2 — SDK rewire

| ID | Task | Type | Gate | DoD highlight |
|----|------|------|------|---------------|
| 0.2.1 | Import generated paths | codegen | G0.2 | specs unchanged |
| 0.2.2 | `GUEST_CATALOG_PATH_NOT_CONFIGURED` | codegen | G0.2 | Z09 pass |
| 0.2.3 | Delete hand map | codegen | G0.2 | Z04 pass |
| 0.2.4 | OUTPUT_PATHS + MIGRATION-MAP | doc | G0.8 | guard-docs |

**Verify PR-A:**
```bash
pnpm run guard:workspace-registry-fresh
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/resolve-catalog-api-path.spec.ts
node --test scripts/tests/test-extract-catalog-paths.mjs
```

---

## Epic PF-0.3 — Flow surface

| ID | Task | Type | Gate |
|----|------|------|------|
| 0.3.1 | Manifest Step A denali+urban | doc | G0.3 |
| 0.3.2 | Generator validate surface fields | codegen | G0.3 |
| 0.3.3 | `generateWorkspaceRegistrationFlowSurfaceBootstrap` | codegen | G0.3 |
| 0.3.4 | Wire register.ts | codegen | G0.3 |

## Epic PF-0.4 — Flow steps (SPIKE MANDATORY)

| ID | Task | Type | Gate | Strict note |
|----|------|------|------|-------------|
| **0.4.0** | SPIKE denali steps diff | codegen | G0.4 | **Architect comment on PR required** |
| 0.4.1 | Manifest union schema | doc | G0.3 | ADR-GP-001 if new keys |
| 0.4.2 | Urban reuseFrom manifest | doc | G0.3 | P13 explicit |
| 0.4.3 | Generate flow-steps file | codegen | G0.3 | separate file P6 |
| 0.4.4 | Delete hand flow plugins file | codegen | G0.3 | Z11 pass |
| 0.4.5 | `guard-guest-e2e-hooks.mjs` | guard | G0.5 | reads YAML |
| 0.4.6 | SMK-PTL-01 | canary | G0.6 | **merge blocker** |

**PR-B:** 0.3.* + 0.4.* — codegen only until 0.4.6 canary run.

---

## Epic PF-0.5 — Conformance

| ID | Task | Type | Gate |
|----|------|------|------|
| 0.5.1 | `generateWorkspaceGuestConformance` | codegen | G0.7 |
| 0.5.2 | `workspace-guest-conformance.spec.mjs` dual verify | guard | G0.7, P15 |

## Epic PF-0.6 — Gate G0 close

| ID | Task | Type | Gate |
|----|------|------|------|
| 0.6.1 | Run G0.1–G0.9 checklist in PR | doc | G0.* |
| 0.6.2 | Red team §15 checklist | doc | G0.9 |

---

# PHASE 1 — BEHAVIOR (separate PRs each)

## PF-1.8 JSON Schema FIRST (before fail-closed)

| ID | Task | Type | Gate | Strict |
|----|------|------|------|--------|
| 1.8.1 | `workspace-guest-extensions.schema.json` | guard | G1.1 | additionalProperties false |
| 1.8.2 | `guestExtensionsVersion: 1` | guard | G1.1 | — |
| 1.8.3 | Generator validate before emit | guard | G1.1 | exit 1 on fail |
| 1.8.4 | ADR-GP-002 guest schema | doc | G1.1 | admission control |

**PR-C0:** schema only — no behavior change.

## PF-1.1–1.2 Presentation

| PR-C1 | codegen+behavior split: **two PRs** |
| 1.1.1–1.1.3 | manifest + generate presentation | codegen | G1.1 |
| 1.2.1–1.2.4 | fail-closed resolvers | behavior | G1.6 | Canary: SMK-MKT-03 |

## PF-1.3 Dev maps — PR-D (behavior)

| 1.3.1–1.3.5 | dev gen, remove fallback, env, tests | behavior | G1.3 | guest-surface-host test |

## PF-1.4 Shared UI — PR-E (behavior)

| 1.4.1–1.4.6 | package move, denali steps | behavior | G1.5 | **SMK-PTL-01 required**

## PF-1.5–1.6 — PR-F

| 1.5.1–1.5.2 | transpilePackages | codegen | G1 |
| 1.6.1–1.6.2 | hygiene + m17 | guard | G1 |

## PF-1.7 + PF-1.9 — Gate G1

| 1.7.1 | i18n Tier B doc | doc | G1.7 |
| 1.9.1 | `guard-no-default-fallback` | guard | G1.2 |
| 1.9.2 | `guard-guest-frozen-shell` (remove allowlist after phase 1) | guard | G1 |
| 1.9.3 | G1 checklist PR | doc | G1.* |

---

# PHASE 2 — PR-G

| ID | Gate | Canary |
|----|------|--------|
| 2.1.1–2.1.3 memberProfile plugin | G2.1 | — |
| 2.2.1–2.2.3 fail-closed registry | G2.1 | member bff spec |
| 2.4.1 mdoc update | G2 | doc-first |
| 2.5.0 operator authz | DEFER | waiver only |

---

# PHASE 3 — PR-H

| ID | Gate |
|----|------|
| 3.1.1–3.1.2 single bootstrap | G3.3 |
| 3.3.1 registry smoke | G3.2 |
| 3.4.1–3.4.3 `workspace:create --guest` | G3.1 |
| 3.4.4 ADR-GP-003 scaffold command | admission |

---

# PHASE 4 — PR-I (10/10)

| ID | Deliverable |
|----|-------------|
| 4.1.1 | `guard-guest-plugin-conformance.mjs` aggregator |
| 4.2.1 | `guard-generated-banner.mjs` |
| 4.3.1 | `guard-feature-flag-boundary.mjs` |
| 4.4.1 | `guard-structured-errors.mjs` (Z09) |
| 4.5.1 | `guard-no-todo-guest.mjs` (Z10) |
| 4.6.1 | `guard-guest-reuse-from.mjs` (Z12) |
| 4.7.1 | Wire `guard:guest-plugin-conformance` package.json |
| 4.8.1 | Add to `phase-6:fast-track` |
| 4.9.1 | `docs/dev/guest-plugin-conformance.md` |
| 4.9.2 | `docs/dev/guest-registration-e2e-hooks.yaml` |
| 4.9.3 | `docs/dev/adr-guest-plugin/` index |
| 4.9.4 | `docs/dev/waivers/README.md` |
| 4.10.1 | MIGRATION-MAP § guest plugin |
| 4.11.1 | **Architect sign-off** in conformance doc footer |
| 4.12.1 | G4 checklist PR → **score 10/10** |

---

# GUARD BUNDLE SPEC (`guard:guest-plugin-conformance`)

Runs sequentially; **fail-fast**:

1. `guard:workspace-registry-fresh`
2. `guard-intake-plugin-registry.mjs`
3. `guard-no-default-fallback.mjs`
4. `guard-generated-banner.mjs`
5. `guard-feature-flag-boundary.mjs`
6. `guard-guest-e2e-hooks.mjs`
7. `guard-structured-errors.mjs`
8. `guard-no-todo-guest.mjs`
9. `guard-guest-reuse-from.mjs`
10. `workspace-guest-conformance.spec.mjs`

Optional during Phase 0–1 only:
11. `guard-guest-frozen-shell.mjs`

---

# PR LABELS (required)

| Label | Allows |
|-------|--------|
| `guest-plugin/codegen` | unit + registry-fresh; no smokes |
| `guest-plugin/behavior` | smokes mandatory |
| `guest-plugin/guard` | guard self-tests |
| `guest-plugin/doc` | docs only |

---

# WAIVER template

`docs/dev/waivers/guest-plugin-W001.yaml` — see roadmap v6 §4.

---

# Score ladder

| Milestone | Score |
|-----------|-------|
| Roadmap v6 written | 9.7 |
| G0 complete | 9.75 |
| G1 complete | 9.8 |
| G3 + workspace:create | 9.9 |
| G4 + Architect sign-off + zero waivers | **10.0** |

---

# Definition of Done (every task — strict)

- [ ] DoR was satisfied before work started
- [ ] Single PR type (codegen OR behavior OR guard OR doc)
- [ ] Task IDs in PR title/body
- [ ] Gate IDs listed
- [ ] Verify commands run (paste in PR)
- [ ] Canary run if behavior PR
- [ ] P9 doc or "Not Needed" with Architect ACK for protected packages
- [ ] Rollback section
- [ ] Red team item checked if gate-closing
- [ ] No active waiver unless filed with expiry
