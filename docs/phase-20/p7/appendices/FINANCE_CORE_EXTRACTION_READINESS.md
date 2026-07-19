# Finance-core extraction readiness report

```yaml
report_id: FINANCE_CORE_EXTRACTION_READINESS
version: "1.0"
date: "2026-07-19"
scope: packages/finance-core (on-disk package surface)
publish: false
code_movement: none
authority: package.json · guards · FINANCE_HOST_INTEGRATION_KIT.md
```

**Decision:** Not ready to extract to another repository yet.  
**Readiness score: 58 / 100** (packaging + git + registry blockers dominate; engine shape is largely ready).

---

## 1. Package name

| Field | Value | Status |
| ----- | ----- | ------ |
| `name` | `@app-tour/finance-core` | OK — scoped, stable |
| Collision risk | None in monorepo | OK |
| Git tracking | Tracked under `packages/finance-core/` (stabilization commit) | Was untracked; now platform package |

---

## 2. Versioning

| Field | Value | Status |
| ----- | ----- | ------ |
| `version` | `0.1.0` | Pre-1.0; OK for internal |
| Semver policy | Not documented in-package | **GAP** |
| CHANGELOG | Missing | **GAP** |
| Compat aliases | Frozen in public-api allowlist | OK — expand = semver decision |

---

## 3. Exports

| Export path | Maps to | Status |
| ----------- | ------- | ------ |
| `.` | `dist/index.js` + `.d.ts` | OK |
| `./ports` | `dist/ports/index.*` | OK |
| `./domain` | `dist/domain/index.*` | OK |
| `./application` | `dist/application/index.*` | OK |
| `./package.json` | `./package.json` | OK |

| Invariant | Evidence | Status |
| --------- | -------- | ------ |
| No `export *` on root barrel | `src/index.ts` comment + `guard-public-api.mjs` | OK |
| `main` / `types` → `dist/` | `package.json` | OK |
| `files: ["dist", "package.json"]` | `package.json` | OK — src not published |
| `sideEffects: false` | `package.json` | OK |
| ESM `import` condition | Only `require` + `default` | **GAP** — no explicit `import` for pure ESM hosts |

Root surface: `createFinanceService`, `FinanceService`, identity helpers, domain helpers, port/DTO types, frozen compat aliases. Guarded by `scripts/guard-public-api.mjs` + `test/public-api.spec.ts`.

---

## 4. Dependencies

| Kind | Entry | Protocol | Status |
| ---- | ----- | -------- | ------ |
| runtime | `@app-tour/finance-http-contracts` | **`workspace:*`** | **BLOCKER** for out-of-workspace install |
| runtime | (no zod/prisma/workspace packages) | — | OK |
| peerDependencies | **absent** | — | OK for current graph; optional later for Node types |
| devDependencies | `@types/node`, `tsx`, `typescript` | versions pinned | OK — no `@app-tour/config` |
| `private` | `true` | — | **BLOCKER** for npm publish (by design until cut) |
| `license` | `UNLICENSED` | — | Expected for private |

Portability guard (`guard-portability.mjs`) allowlists only `finance-http-contracts` as runtime dep and forbids monorepo `tsconfig.extends`.

---

## 5. Peer dependencies

| Item | Status |
| ---- | ------ |
| Declared peers | **None** |
| Host must supply | 13 ctor ports + repository implementation (not npm peers) |
| Recommendation for extraction | Keep peers empty; document Host Integration Kit as the “peer” contract |

---

## 6. Build output

| Item | Status |
| ---- | ------ |
| Builder | `tsc -p tsconfig.json` (standalone; no `extends`) |
| Module | CommonJS (`"module": "CommonJS"`) |
| `declaration: true` | OK — `.d.ts` emitted |
| `outDir` | `./dist` |
| Observed `dist/` | `index.js`, `index.d.ts`, `application/`, `domain/`, `ports/` |
| Test/src excluded from emit | OK (`include: src/**/*.ts` only) |
| CI publish artifact | Would be `files`-filtered tarball of `dist` + `package.json` |

---

## 7. Generated files

| Item | In finance-core? | Status |
| ---- | ---------------- | ------ |
| Codegen bindings | **No** | OK — host/workspace own `*.generated.ts` |
| Prisma client | **No** | OK |
| Workspace registry | **No** | OK |
| Guards | Hand-written `scripts/*.mjs` | Ship with repo; not required in npm `files` |

Extraction must **not** move host generated bindings into finance-core.

---

## 8. Documentation

| Doc | Role | Status |
| --- | ---- | ------ |
| `FINANCE_HOST_INTEGRATION_KIT.md` | Host adoption checklist | Present |
| `FINANCE_PLATFORM_EVOLUTION_PLAN.md` | Phase narrative | Present |
| `PAYMENT-LEDGER-BOUNDARY.md` | Approve / ledger spine | Present |
| In-package `README.md` | Install / exports / ownership / forbidden deps | Present |
| Semver / CHANGELOG | Consumer contract | **MISSING** (version stays 0.1.0) |
| `external-finance-consumer/README.md` | Second-repo simulation | Present (fixture) |

---

## 9. Migration path: `workspace:*` → registry package

**Do not publish in this phase.** Ordered path when packaging is approved:

```text
1. Commit packages/finance-core (+ contracts packaging parity) to trunk
2. Align versions: finance-http-contracts@X.Y.Z, finance-core@X.Y.Z
3. Replace finance-core dependency:
     "workspace:*"  →  "X.Y.Z"   (or "^X.Y.Z")
   Same for contracts inside finance-core/package.json
4. Clear or gate private:true for the release channel (internal registry OK)
5. Build both packages; pack verify:
     pnpm pack / npm pack — inspect tarball contains only dist + package.json
6. Publish contracts first, then finance-core, to the chosen registry
7. Monorepo consumers:
     apps/api: "@app-tour/finance-core": "workspace:*"  OR  "X.Y.Z"
     Prefer workspace:* while both live in monorepo; switch external hosts to registry
8. External host:
     npm i @app-tour/finance-core@X.Y.Z @app-tour/finance-http-contracts@X.Y.Z
     Implement Host Integration Kit §1–§3
9. Retire external-finance-consumer staging rewrite (workspace:* → file:) once registry works
```

**Proven today (local only):** `external-finance-consumer` stages dist and rewrites `workspace:*` → file/semver for `--ignore-workspace` install. That is a **simulation**, not a registry cut.

---

## 10. Blockers vs ready

### Ready (engine packaging shape)

- Scoped name, explicit exports map, dist-only `files`
- Standalone tsconfig + portability/boundary/public-api guards
- Single runtime dep (contracts); no Prisma/workspace imports in package design
- Host Integration Kit documents 13 ports + Option C ownership

### Blockers (before another-repo extraction)

| # | Blocker |
| - | ------- |
| 1 | Package committed to trunk | Cleared at finance-core stabilization |
| 2 | `workspace:*` on contracts → fails outside pnpm workspace | **BLOCKER** for out-of-workspace install |
| 3 | `private: true` — no publish | **BLOCKER** for npm publish (by design until cut) |
| 4 | Sibling contracts also `private` + must be versioned/published first | **BLOCKER** |
| 5 | Semver CHANGELOG policy incomplete | **GAP** (README present; CHANGELOG still missing) |
| 6 | No registry / CI pack job | **BLOCKER** |
| 7 | Host still required for Prisma/RLS/outbox (by design — not moved) | Not a packaging bug |

### Non-goals (correctly out of package)

- Prisma, RLS, outbox writers
- Workspace adapters / codegen
- HTTP idempotency lease store

---

## 11. Extraction checklist (when approved)

- [ ] Commit `packages/finance-core` to trunk  
- [ ] In-package README (exports, Node ≥24, Host Integration Kit link)  
- [ ] CHANGELOG + semver policy (0.x until freeze)  
- [ ] Replace `workspace:*` → semver in finance-core → contracts  
- [ ] Pack both packages; install in a clean temp dir without monorepo  
- [ ] Run Host Integration Kit conformance (or external-finance-consumer against packed tarballs)  
- [ ] Optional: add `exports["."].import` if ESM consumers required  
- [ ] **Still do not** move Prisma/RLS/outbox into the extracted repo  

---

## 12. Scorecard

| Dimension | Score | Note |
| --------- | ----: | ---- |
| Name / exports shape | 85 | Strong; minor ESM gap |
| Versioning / changelog | 40 | 0.1.0 only |
| Dependencies / peers | 45 | `workspace:*` + private |
| Build output | 80 | Clean dist CJS |
| Generated-file hygiene | 90 | None in package |
| Documentation | 70 | Kit exists; package README missing |
| Git / publish readiness | 45 | Tracked; still private + workspace:* |
| **Composite** | **62** | Untracked blocker cleared; packaging protocol remains |

**Recommendation:** Keep developing as an **internal monorepo package**. Complete commit + `workspace:*`→semver + contracts publish path before any second-repository move. Do **not** publish now.
