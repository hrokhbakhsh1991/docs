# Finance-core freeze audit — internal platform API

```yaml
audit_id: FINANCE_CORE_INTERNAL_FREEZE
version: "1.0"
date: "2026-07-19"
claim: finance-core API stable for internal platform usage
verdict: READY
publish: false
external_registry: out of scope for this claim
```

## Verdict

**READY** — `@app-tour/finance-core` may be treated as a frozen internal platform API.

**Exact blockers:** none.

---

## Checklist evidence

### 1. Git state — PASS

| Check | Result |
| ----- | ------ |
| Committed | Yes — `1639d421` `chore(finance): track finance-core as stable internal platform package` |
| Untracked under `packages/finance-core/` | **0** |
| Tracked files | **44** (src, tests, guards, README, package.json, tsconfig) |
| Working tree on package | Clean (no `M`/`??` on finance-core at audit time) |
| Boundary guards | `guard:boundary` / `guard:portability` / `guard:public-api` **PASS** |

### 2. Public API — PASS

| Check | Result |
| ----- | ------ |
| Root `src/index.ts` | Explicit exports only (no `export *`); allowlist **69** symbols |
| Package `exports` | `.` / `./ports` / `./domain` / `./application` / `./package.json` |
| Ports exposed | All 13 ctor ports + DTOs via root and `./ports` |
| Domain / application | Separate barrels; service in `application/`; pure helpers in `domain/` |
| Host leakage | Guards + tests: no Prisma / Host / workspace / generated names on public surface |
| Tests | **30/30** PASS (incl. public-api freeze + external-consumer simulation) |

### 3. Dependency — PASS (internal)

| Check | Result |
| ----- | ------ |
| `src/` imports | Relative + `node:crypto` + `@app-tour/finance-http-contracts` only |
| `apps/api` imports | **None** |
| Generated bindings | **None** |
| Prisma / fs / `process.env` in `src/` | **None** |
| `package.json` → contracts | `workspace:*` — **allowed for monorepo-internal freeze**; not a blocker for this claim |

> Out of scope: replacing `workspace:*` with registry semver (external/publish cut — see `FINANCE_DEPS_WORKSPACE_TO_REGISTRY.md`).

### 4. Documentation — PASS

| Check | Result |
| ----- | ------ |
| Package README | Present — ownership, composition sketch, forbidden deps, scripts |
| Integration expectations | README + [`FINANCE_HOST_INTEGRATION_KIT.md`](./FINANCE_HOST_INTEGRATION_KIT.md) |
| Forbidden dependencies | Documented in README; enforced by package guards |

---

## Explicit non-claims

- Not published (`private: true`)
- Not cleared for second-repository install without pack/semver rewrite
- Host (`apps/api`) debt (singletons, façades, boot default) is **out of engine freeze scope**
