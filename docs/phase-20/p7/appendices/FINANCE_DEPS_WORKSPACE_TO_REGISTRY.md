# Finance dependency chain — workspace → published packages

```yaml
plan_id: FINANCE_DEPS_WORKSPACE_TO_REGISTRY
version: "1.0"
date: "2026-07-19"
publish: false
logic_changes: none
packages:
  - "@app-tour/finance-http-contracts"
  - "@app-tour/finance-core"
```

**Goal:** Remove the assumption that both packages must live in the same pnpm workspace, without publishing yet and without changing finance logic.

---

## 1. Audit summary

| Check | `finance-http-contracts` | `finance-core` |
| ----- | ------------------------ | -------------- |
| Package name | `@app-tour/finance-http-contracts` | `@app-tour/finance-core` |
| Version | `0.1.0` | `0.1.0` |
| `private` | `true` | `true` |
| Runtime deps | `zod@^3.24.2` (registry) | **`@app-tour/finance-http-contracts`: `workspace:*`** |
| Peer deps | none | none |
| `exports` | `.` only | `.` / `./ports` / `./domain` / `./application` |
| `files` | `dist`, `package.json` | `dist`, `package.json` |
| Build | standalone `tsc` (no `extends`) | standalone `tsc` (no `extends`) |
| Generated artifacts in package | **none** | **none** |
| In-package README | **missing** | present |
| Git tracked | yes (src + package.json + tsconfig) | yes (stabilization commit) |

### 1.1 `workspace:*` dependencies

| Edge | Protocol | External impact |
| ---- | -------- | --------------- |
| `finance-core` → `finance-http-contracts` | `workspace:*` in **source** `package.json` | `pnpm install --ignore-workspace` / plain npm **fails** until rewritten |
| Monorepo consumers → both | `workspace:*` (`apps/api`, workspaces, `finance-http`) | Fine inside monorepo |
| Contracts → zod | `^3.24.2` | Already registry-compatible |

**Packing note (verified):** `pnpm pack` on `finance-core` **rewrites** the tarball `package.json` dep to `"@app-tour/finance-http-contracts": "0.1.0"` (exact version). Source tree still contains `workspace:*`. External installs from a **packed** tarball do not need the workspace protocol; installs from a **git checkout** of the monorepo package folder still do.

### 1.2 Semver compatibility

| Pair | Current | Target rule |
| ---- | ------- | ----------- |
| contracts ↔ core | both `0.1.0` | Keep **lockstep** until 1.0 (core depends on contracts major.minor) |
| Suggested range after cut | core → contracts | `"0.1.0"` exact for first release, then `"^0.1.0"` once API stable |
| Breaking contracts API | bump contracts + core together | Document in CHANGELOG when introduced |

No peerDependency required today: core takes a normal dependency on contracts (types + re-exports). Hosts that only implement workspace adapters may depend on **contracts alone**.

### 1.3 Build order

```text
1. pnpm -C packages/finance-http-contracts run build   # emits dist/
2. pnpm -C packages/finance-core run build             # typechecks against contracts
3. (optional) pack contracts, then pack core
```

No codegen step inside either package. Host `generate:workspace-registry` stays monorepo-only.

### 1.4 Generated artifacts

| Location | Generated? | Extraction impact |
| -------- | ---------- | ----------------- |
| `finance-http-contracts` | No | Ship `src` → build `dist` only |
| `finance-core` | No | Same |
| `apps/api` `*.generated.ts` | Yes | **Stays in host** — not part of this chain |

### 1.5 Package packing (verified dry-run)

**`@app-tour/finance-http-contracts@0.1.0` tarball contains:**

- `package/package.json` (`private: true` still set)
- `package/dist/*.js` + `*.d.ts` (schemas, ports, index)
- **No** README in tarball (file absent)

**`@app-tour/finance-core@0.1.0` tarball contains:**

- `package/package.json` with contracts dep rewritten to `0.1.0`
- `package/dist/**` (+ README included by npm/pnpm pack defaults)
- `private: true` still set → registry publish would need policy override or clearing `private` for the release channel

**Both** still marked `private: true` inside the tarball → default npm publish is blocked (intentional until a publish cut).

---

## 2. Current vs target

### Current (monorepo)

```text
pnpm workspace
  finance-http-contracts@0.1.0  (private, zod from registry)
  finance-core@0.1.0            (private, contracts via workspace:*)
  apps/api, workspaces/*        (workspace:* → both)
```

### Target (external repository / registry)

```text
registry (or private Verdaccio / GitHub Packages)
  @app-tour/finance-http-contracts@0.1.x
  @app-tour/finance-core@0.1.x   → depends on contracts@^0.1.0 (or exact)

external host repo (no pnpm workspace with app-tour)
  dependencies:
    "@app-tour/finance-core": "0.1.x"
    "@app-tour/finance-http-contracts": "0.1.x"   # optional if only using core re-exports
  implements Host Integration Kit ports
```

Monorepo may keep `workspace:*` **after** publish for local development (pnpm resolves workspace over registry when both present), or pin semver like external hosts.

---

## 3. Migration plan (do **not** publish in this phase)

### Phase A — Source hygiene (no registry)

1. Keep versions at `0.1.0` (no strategy change required).
2. Document build order in both READMEs (contracts README still missing — add when packaging).
3. Optionally replace source `workspace:*` with `"0.1.0"` **only when** ready for dual install (monorepo + external). Until then, rely on `pnpm pack` rewrite for tarball consumers.
4. Prove external install without monorepo workspace:
   - `pnpm pack` both packages
   - In a temp dir: `npm init` + install both tarballs
   - Import `createFinanceService` from core; typecheck a stub host  
   (Already approximated by `external-finance-consumer` staging.)

### Phase B — Registry cut (future YES)

1. Choose registry + auth (private scope `@app-tour`).
2. Clear or override `private` for the release pipeline only.
3. Publish **contracts first**, then **core**.
4. Tag git `finance-http-contracts@0.1.0` / `finance-core@0.1.0`.
5. External hosts: `npm i @app-tour/finance-core@0.1.0`.
6. Monorepo: either keep `workspace:*` or switch to `"0.1.0"` with `pnpm.overrides` as needed.

### Phase C — Post-publish monorepo

1. CI: build contracts → build core → (optional) pack smoke.
2. Retire `external-finance-consumer` staging rewrite once registry install works.
3. CHANGELOG entries for any future public API change (core allowlist / contracts ports).

---

## 4. What must not change

- FinanceService behavior, approve atomicity, ledger formulas, event payloads
- Moving Prisma/RLS/outbox into either package
- Generating workspace bindings inside these packages

---

## 5. Blockers before external-repo usage (honest)

| # | Blocker | Severity |
| - | ------- | -------- |
| 1 | Source `workspace:*` on core → contracts | High for git-path installs |
| 2 | Both `private: true` | High for npm publish |
| 3 | No registry / CI publish job | High |
| 4 | Contracts lack README | Low |
| 5 | No CHANGELOG / range policy doc | Medium |
| 6 | Host adapters still required (by design) | N/A — not a chain bug |

**Non-blocker:** Packing already produces installable dist artifacts; contracts have no monorepo-only runtime deps except being private.

---

## 6. Recommended next actions (when approved)

1. Add `packages/finance-http-contracts/README.md` (ownership, zod, no workspace protocol).  
2. Add CI job: build + `pnpm pack` + install tarballs in clean directory (no publish).  
3. Decide: keep `workspace:*` in source until publish day, or switch source to `"0.1.0"` now for honesty.  
4. Do **not** publish until product YES.  
5. Follow [`FINANCE_SEMVER_POLICY.md`](./FINANCE_SEMVER_POLICY.md) for bumps (contracts → core).
