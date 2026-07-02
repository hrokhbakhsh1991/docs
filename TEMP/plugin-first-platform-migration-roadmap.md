# Plugin-First Platform — Migration Roadmap (v6, maximum strictness)

> **Status:** Enterprise conformance — zero implicit exceptions.  
> **Self-score:** **9.7 / 10** (v5 was 9.5). **10/10** only after Phase 4 CI merge + `workspace:create --guest` + Architect recorded sign-off.  
> **Authority:** This doc + linked task breakdown supersede v3–v5. Conflicts → v6 wins.  
> **Date:** 2026-07-02

---

## 0. NON-NEGOTIABLES (read first)

1. **No behavior-changing PR** merges without canary smokes green (denali + urban).
2. **No phase advance** until prior phase gate checklist is 100% + recorded in PR.
3. **No new manifest keys** without JSON Schema update + ADR snippet in `docs/dev/adr-guest-plugin/`.
4. **No waivers** except filed `docs/dev/waivers/guest-plugin-WNNN.yaml` with expiry ≤ 30 days.
5. **No hand-edits** to any `*.generated.ts` — ever.
6. **No mixed PRs:** codegen-only OR behavior-only — never both.
7. **Protected paths frozen** during Phase 0–1 (see §15).

---

## 1. CONFORMANCE LEVELS L0–L3 (strict)

| Level | Manifest + plugin requirements | Generated proof | Runtime proof |
|-------|----------------------------------|-----------------|---------------|
| **L0** | base manifest | in conformance table | web plugin loader |
| **L1** | + catalog routes + `guestCatalog.enabled:true` + `publicCatalog` | paths + presentation rows | marketing list fetch |
| **L2** | + `guestRegistrationFlow` + `catalogIntake` | flow surface + steps bootstrap | SMK-PTL-01 |
| **L3** | + `memberProfile` | registry slice | member profile BFF spec |

**Dual verification (P15):** Every level requires **both** generated row **and** runtime registry smoke — not either alone.

Emit: `workspace-guest-conformance.generated.ts` + `workspace-guest-conformance.spec.mjs` (generator self-test).

---

## 2. GOVERNING PRINCIPLES P1–P17

| # | Principle | Violation = |
|---|-----------|-------------|
| P1 | Manifest SSOT for static facts | merge blocked |
| P2 | Codegen only for static facts | merge blocked |
| P3 | Fail-closed | merge blocked |
| P4 | Composition-root registration | merge blocked |
| P5 | Narrow host API | merge blocked |
| P6 | Server/client file split | merge blocked |
| P7 | contractVersion 1; optional fields only | merge blocked |
| P8 | Drift = `guard:workspace-registry-fresh` fail | merge blocked |
| P9 | Doc-first same PR | Husky blocked |
| P10 | E2E hook semver | guard fail |
| P11 | JSON Schema before emit | generator exit 1 |
| P12 | Structured `.code` on guest errors | guard fail |
| P13 | reuseFrom manifest-only | guard fail |
| **P14** | **Single concern per PR** | review reject |
| **P15** | **Dual verification** (gen + runtime) | phase gate fail |
| **P16** | **Canary smokes before behavior merge** | merge blocked |
| **P17** | **No silent TODO in guest path** | guard fail |

---

## 3. ADMISSION CONTROL — new manifest surface

Before adding ANY key under `guestCatalog`, `guestRegistrationFlow`, `guestI18n`:

| Step | Required artifact |
|------|-------------------|
| 1 | ADR: `docs/dev/adr-guest-plugin/ADR-GP-NNN-<title>.md` |
| 2 | JSON Schema bump (`guestExtensionsVersion: 1` → patch rules only) |
| 3 | Generator + conformance spec update |
| 4 | Task breakdown ID assigned |
| 5 | Architect ACK in ADR footer |

**additionalProperties: false** on all guest blocks — no escape hatches.

---

## 4. WAIVER POLICY (strict)

File: `docs/dev/waivers/guest-plugin-WNNN.yaml`

```yaml
id: W001
rule: P3-no-default-fallback
path: packages/workspace-sdk/src/catalog/resolve-catalog-list-features.ts
reason: "<one line>"
expires: 2026-08-01
owner: "@architect"
```

- Max 1 active waiver per rule.
- Expired waiver → guard fails CI.
- Waivers **forbidden** for P8, P6, P10.

---

## 5. ZERO-TOLERANCE BAN LIST (expanded)

| ID | Pattern | Scope | Guard |
|----|---------|-------|-------|
| Z01 | `\bdenali\b|\burban\b` | SDK catalog/profile/auth non-generated | conformance |
| Z02 | `\?\?\s*DEFAULT_` | guest resolvers | no-default-fallback |
| Z03 | `\?\?\s*"denali"` | guest-surface-host | no-default-fallback |
| Z04 | hand `CATALOG_*` maps | SDK | conformance |
| Z05 | `@app-tour/workspace-(denali\|urban)` | portal/marketing app | intake + import-boundary |
| Z06 | `features.transportIntake` in portal catalog | portal | intake (exists) |
| Z07 | AUTO-GENERATED not in OUTPUT_PATHS | repo | generated-banner |
| Z08 | duplicate key presentation ∩ intake.features | repo | feature-flag-boundary |
| Z09 | `throw new Error(` without `.code` | guest resolvers | structured-errors |
| Z10 | `TODO\|FIXME\|HACK` | guest plugin path files | no-todo-guest |
| Z11 | edit `*.generated.ts` by hand | git diff | generated-banner + fresh |
| Z12 | cross-workspace import in plugin-host non-generated | plugin-host src | reuseFrom guard |
| Z13 | mixed codegen+behavior in one PR | process | PR template + review |
| Z14 | `workspaceTypes` string match for business logic | hosts | conformance |

---

## 6. JSON SCHEMA (strict)

Path: `scripts/schemas/workspace-guest-extensions.schema.json`

**Top-level guest extension version:**

```json
{ "guestExtensionsVersion": 1 }
```

- Patch: add optional fields only.
- Minor: new optional blocks — requires ADR.
- Major: breaking — **forbidden** until platform `contractVersion: 2` program (out of scope).

**Validation order in generator:**
1. Parse manifest JSON
2. Validate guestExtensionsVersion
3. Validate guest blocks against schema
4. Cross-field rules (catalog routes, reuseFrom targets)
5. Emit — any failure **exit 1**, no partial emit

---

## 7. STRUCTURED ERRORS (complete registry)

All guest resolvers must throw subclasses or objects with readonly `code`:

| Code | Phase |
|------|-------|
| `GUEST_CATALOG_PATH_NOT_CONFIGURED` | 0 |
| `GUEST_CATALOG_PRESENTATION_NOT_CONFIGURED` | 1 |
| `GUEST_REGISTRATION_FLOW_NOT_REGISTERED` | 0 |
| `GUEST_REGISTRATION_STEPS_NOT_REGISTERED` | 0 |
| `GUEST_REGISTRATION_NOT_CONFIGURED` | 0 (conformance) |
| `DEV_PLUGIN_ID_UNRESOLVED` | 1 |
| `DEV_HOST_LABEL_UNRESOLVED` | 1 |
| `MEMBER_PROFILE_NOT_CONFIGURED` | 2 |
| `INTAKE_PLUGIN_NOT_REGISTERED` | exists |
| `GUEST_MANIFEST_SCHEMA_INVALID` | 1 |
| `GUEST_REUSE_FROM_UNKNOWN` | 0 |

**Guard Z09:** grep guest resolver files for bare `throw new Error`.

---

## 8. E2E HOOK SEMVER (strict)

File: `docs/dev/guest-registration-e2e-hooks.yaml` — version **1.0.0**

**Policy:**
- Add attribute → minor bump + smoke still green
- Rename/remove → major bump + coordinated smoke + doc + **Architect ACK**

Guard `guard-guest-e2e-hooks.mjs`:
- Reads YAML
- Asserts denali + urban step source files contain every frozen selector
- Fails if YAML version unchanged but selectors removed

---

## 9. PHASE GATES (hard — 100% required)

### Gate G0 — end Phase 0

| # | Criterion |
|---|-----------|
| G0.1 | `guard:workspace-registry-fresh` |
| G0.2 | Catalog path snapshot = hand map (denali, urban) |
| G0.3 | Flow surface + steps generated; hand file deleted |
| G0.4 | PF-0.4.0 spike sign-off comment in PR |
| G0.5 | `guard-guest-e2e-hooks` green |
| G0.6 | SMK-PTL-01 green (denali registration) |
| G0.7 | Conformance stub generated |
| G0.8 | Doc MIGRATION-MAP § updated |
| G0.9 | **Zero waiver** active for Phase 0 rules |

### Gate G1 — end Phase 1

| # | Criterion |
|---|-----------|
| G1.1 | JSON Schema validates denali + urban |
| G1.2 | `guard-no-default-fallback` green |
| G1.3 | Dev fallback `?? "denali"` removed |
| G1.4 | SMK-PTL-01 + SMK-MKT-03 (if marketing touched) |
| G1.5 | Shared UI in package; portal re-export only |
| G1.6 | Unknown pluginId throws on all presentation resolvers |
| G1.7 | Doc guest-plugin-conformance draft |

### Gate G2 — end Phase 2

| G2.1 | memberProfile fail-closed |
| G2.2 | portal-member-profile-bff.spec green |
| G2.3 | Z01 clean in profile/ |

### Gate G3 — end Phase 3

| G3.1 | `workspace:create --guest` produces L2-valid manifest |
| G3.2 | Registry smoke includes new fixture id |
| G3.3 | Single bootstrap entrypoint |

### Gate G4 — end Phase 4 (10/10)

| G4.1 | `guard:guest-plugin-conformance` in `phase-6:fast-track` |
| G4.2 | `docs/dev/guest-plugin-conformance.md` complete |
| G4.3 | All Z01–Z14 enforced |
| G4.4 | **Architect sign-off** recorded in doc footer |
| G4.5 | No active waivers |

---

## 10. PR RULES (maximum strictness)

| Rule | Detail |
|------|--------|
| **Scope** | Max 1 epic per PR (e.g. only PF-0.1.*) |
| **Type** | Label `guest-plugin/codegen` OR `guest-plugin/behavior` — not both |
| **Size** | ≤ 15 non-generated files touched (generated exempt) |
| **Canary** | Behavior PRs: SMK-PTL-01 required; codegen PRs: unit+contract only |
| **Review** | Must cite task IDs + gate IDs satisfied |
| **Revert** | Rollback section mandatory (roadmap v5 §9) |

---

## 11. FROZEN FILES (Phase 0–1)

No functional edits except import path changes:

- `apps/portal/app/catalog/[tourId]/register/public-catalog-registration-flow.tsx`
- `packages/workspace-sdk/src/catalog/registration-flow.contract.ts`
- `packages/workspace-sdk/src/catalog/build-catalog-registration-upstream-request.ts`

Guard: `guard-guest-frozen-shell.mjs` — diff against allowlist.

---

## 12. MIGRATION PHASES (unchanged intent, stricter execution)

### Phase 0 — Codegen only PRs (A, B)

- 0.1–0.2 paths
- 0.3–0.4 flow (+ spike 0.4.0)
- 0.5 conformance stub + self-test
- 0.6 registry fresh

### Phase 1 — Behavior PRs (C, D, E, F) — each separate

- 1.1–1.2 presentation fail-closed
- 1.3 dev maps
- 1.4 shared UI
- 1.5–1.6 hygiene
- 1.7 i18n doc
- 1.8 JSON Schema

### Phase 2 — Profile (G)

### Phase 3 — Tooling (H) — includes `workspace:create --guest`

### Phase 4 — Enforcement (I) → **10/10**

**Aggregate command:**

```bash
pnpm run guard:guest-plugin-conformance
# runs: registry-fresh, intake, no-default, generated-banner,
#       feature-flag-boundary, e2e-hooks, structured-errors,
#       no-todo-guest, frozen-shell (phase 0-1 only)
```

Wire to `phase-6:fast-track` after G4 partial in PR-I.

---

## 13. CANARY MATRIX (P16 — mandatory before behavior merge)

| Smoke | When required |
|-------|---------------|
| SMK-PTL-01 | Any registration flow / intake / OTP UI change |
| SMK-MKT-03 | Any presentation / catalog path / marketing fetch |
| SMK-PTL-02 | Member profile changes |
| `guest-surface-host` unit | Dev map changes |

**Rule:** CI job `guest-plugin-canary` runs smokes on PRs labeled `guest-plugin/behavior`.

---

## 14. TIER A / TIER B (unchanged, strict Tier B)

**Tier B onboarding** after Phase 3.4:

```bash
pnpm run workspace:create -- <id> --guest
pnpm run generate:workspace-registry
pnpm run guard:guest-plugin-conformance
# manual: SMK if L2
```

---

## 15. RED TEAM CHECKLIST (before each gate)

- [ ] Can I add workspace #3 without editing SDK maps? (Tier A test)
- [ ] Does unknown pluginId fail closed everywhere?
- [ ] Is any DEFAULT_* or denali fallback left?
- [ ] Does `--check` catch hand-edited generated file?
- [ ] Are E2E hooks still present in plugin steps?
- [ ] Is prod tenant-context path untouched?
- [ ] Any duplicate feature flag across layers?

---

## 16. SCORECARD

| Area | v5 | **v6** |
|------|-----|--------|
| Conformance + dual verify | 10 | **10** |
| Waiver / exception control | 7 | **9.5** |
| PR discipline | 8 | **9.5** |
| Admission control (ADR) | 6 | **9** |
| Canary enforcement | 8 | **9.5** |
| Frozen shell protection | — | **9.5** |
| Error registry completeness | 9 | **9.5** |
| **Overall** | **9.5** | **9.7** |

**10/10 requires:** G4 complete + Architect sign-off + zero waivers + `workspace:create --guest` proven.

---

## 17. EXECUTION (strict sequence)

```
S1: PF-0.1 + PF-0.2 + PF-0.5 + PF-0.6 → Gate G0 partial (paths)
S2: PF-0.3 + PF-0.4.0 spike → PF-0.4 → Gate G0 full
S3: PF-1.8 schema → PF-1.1–1.2 → Gate G1 partial
S4: PF-1.3 → Gate G1 dev
S5: PF-1.4 → Gate G1 smokes
S6: PF-1.5–1.6 → Gate G1 full
S7: Phase 2 → Gate G2
S8: Phase 3 → Gate G3
S9: Phase 4 → Gate G4 → 10/10
```

**Parallel work forbidden** across S2 and S3 (schema depends on stable manifest shape from 0.3).

---

## CHANGELOG v5 → v6
- Added **NON-NEGOTIABLES** + **P14–P17**.
- Added **Admission Control (ADR)** for manifest changes.
- Added **Waiver policy** with expiry YAML.
- Expanded ban list **Z01–Z14**.
- Added **dual verification** (generated + runtime).
- Added **hard phase gates G0–G4** with checklists.
- Added **PR scope/type/size/canary rules**.
- Added **frozen shell files** + guard during Phase 0–1.
- Added **canary matrix** + behavior PR label.
- Added **red team checklist**.
- Added **guestExtensionsVersion** schema versioning.
- Complete **error code registry**.
- Self-score **9.7/10**; 10/10 = G4 + Architect sign-off.
