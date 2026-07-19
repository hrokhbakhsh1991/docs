# Hostile external host simulation — finance-core

```yaml
sim_id: FINANCE_CORE_HOSTILE_EXTERNAL_HOST
version: "1.0"
date: "2026-07-19"
scenario: new company / new repo / no apps/api / no workspaces / no pnpm workspace
artifacts: pnpm pack tarballs (stand-in for "published")
behavior_changes: none
```

## Scenario

A greenfield host:

- Empty git repo outside the monorepo
- `npm install` (not pnpm workspace)
- Only `@app-tour/finance-core` + `@app-tour/finance-http-contracts`
- Host implements all ports itself (in-memory fakes for this sim)

**Stand-in for publish:** `pnpm pack` → local `.tgz` (registry does not have `@app-tour/*`).

---

## Validation matrix

| # | Capability | Result | Evidence |
| - | ---------- | ------ | -------- |
| 1 | Install finance-core | **PASS*** | Both tarballs as `file:` deps → `npm install` OK |
| 2 | Compile TypeScript | **PASS** | `tsc` exit 0 against package `.d.ts` |
| 3 | Implement required ports | **PASS** | 13 ctor ports + full `FinanceRepositoryPort` (host-owned) |
| 4 | Create `FinanceService` | **PASS** | `createFinanceService(...)` from packed dist |
| 5a | Create payment | **PASS** | Pending manual payment |
| 5b | Prepayment | **PASS** | Record + ledger policy probe |
| 5c | Approve flow | **PASS** | Paid + booking `paid` + Approved |
| 5d | Ledger capture | **PASS** | Policy plan + host outbox row with stable `domainEventId` |

\*See package blockers: true registry publish / core-only install still fail.

### What was **not** available to the hostile host

- `apps/api`
- `@app-tour/workspace-*`
- monorepo `pnpm-workspace.yaml`
- Prisma / RLS helpers
- Generated bindings

---

## Package blockers (exact)

| Blocker | Severity | Impact |
| ------- | -------- | ------ |
| **No packages on npm registry** | **Hard** | Real `npm i @app-tour/finance-core@0.1.0` → **404**. Simulation only works with packed/local tarballs or a private registry. |
| **`private: true`** on core + contracts | **Hard** for publish | Default `npm publish` blocked until release channel clears/overrides `private`. |
| **Core-only install** | **Hard** | Packed core depends on `@app-tour/finance-http-contracts@0.1.0`. Without publishing **or** also providing the contracts tarball, install fails with registry 404. |
| **Source `workspace:*`** (unpacked package.json) | **Hard** for git/`file:` src | `npm install` on source trees → `EUNSUPPORTEDPROTOCOL workspace:*`. Pack rewrite to `0.1.0` is required for npm consumers. |
| **`files: ["dist"]` requires prior build** | Medium | Consumers never get `src/`; empty/missing `dist` → unusable package. |
| **Stale `dist` without clean** | Medium | Dirty `dist/` can ship orphan artifacts (observed: leftover `workspace-finance-event-reaction.port.*` until `rm -rf dist && build`). Pack must follow clean build. |

**Not blockers for the tarball+both-packages path:** `private` does not block local tarball install; engine behavior works.

---

## Documentation blockers (exact)

| Blocker | Severity | Impact |
| ------- | -------- | ------ |
| **Host Integration Kit not in tarball** | High | Kit lives under monorepo `docs/`; hostile host only gets core `README.md` (relative link to `../../docs/...` **breaks** outside the monorepo). |
| **Contracts package has no README** | Medium | No install/ownership/forbidden-deps doc in contracts tarball. |
| **Outbox writer contract undocumented in packages** | High | Kit describes host outbox; type lives under `apps/api` today — hostile host must invent enqueue shape from kit prose / payload DTOs. |
| **Ledger `eventType` naming drift risk** | Medium | Normative event: `finance.ledger.double_entry_applied`. Host fakes may use other strings unless kit is followed literally. |

---

## Missing contracts (exact)

| Missing from published surface | Needed for |
| ------------------------------ | ---------- |
| **`FinanceOutboxWriter` / enqueue input type** in `@app-tour/finance-http-contracts` (or finance-core) | Typed TX outbox insert without copying `apps/api` |
| **Typed ambient TX brand** (optional) | Avoid opaque `object` + host cast for `raisePaidInTx` |
| **HTTP idempotency lease port** | Portable HTTP layer (engine assumes host owns leases) |
| **Published Host Integration Kit** alongside packages | Second company without monorepo docs checkout |
| **Registry / semver release** of both packages | Real “published only” install |

**Intentionally not missing (host-owned by design):** Prisma schema, RLS, booking DB, workspace CoA implementations.

---

## Honest summary for a new company

| Path | Can they run finance-core? |
| ---- | -------------------------- |
| Both packages **published** to a reachable registry (or both tarballs) + Host Kit + implement 13 ports + repository Option C | **Yes** (proven in this sim with tarballs) |
| Only finance-core on npm today | **No** — contracts 404; nothing published |
| Clone monorepo package folders with `workspace:*` | **No** — npm protocol error |
| Expect engine to ship Prisma/outbox/booking | **No** — by design; host must implement |

### Simulation command sketch (reproducible)

```bash
pnpm -C packages/finance-http-contracts run build
rm -rf packages/finance-core/dist && pnpm -C packages/finance-core run build
pnpm -C packages/finance-http-contracts pack --pack-destination /tmp/packs
pnpm -C packages/finance-core pack --pack-destination /tmp/packs
# In a directory outside the monorepo:
npm i \
  file:/tmp/packs/app-tour-finance-http-contracts-0.1.0.tgz \
  file:/tmp/packs/app-tour-finance-core-0.1.0.tgz
# Implement ports → createFinanceService → payment / prepay / approve / ledger
```

---

## Verdict

**Engine runtime (given both packed packages + host adapters): CAPABLE.**

**“Published-only new company” as stated today: BLOCKED** until registry publish (or private registry) of **both** packages and ship/link of Host Integration Kit + outbox writer contract.
