# P1 — Platform Control Center · Exit checklist

Copied from master map **§J — Exit criteria** (`TEMP/p1-super-admin-v1.md`).

**Evidence tiers:** `[x] code` · `[x] unit-behavior` · `[x] unit-grep` · `[x] E2E` · `[ ] manual`

Last verified: **2026-06-21** — `p1:gate` OK · `p1:e2e-gate` **11/11** · unhealthy KPI E2E added · catalog/portal **P2**.

Check boxes only when evidence exists at the claimed tier.

## API & provision

- [x] code · [x] unit-behavior · [ ] E2E · [ ] manual — `POST /platform/v1/tenants` **201** + `tenant`/`sites`/`invite` — `platform-provision.spec.ts` (handler 401/403/400; 201 when `DATABASE_URL` set)
- [x] code · [x] unit-behavior · [ ] E2E · [ ] manual — `GET /platform/v1/tenants` list — `platform-tenants-list.spec.ts`
- [x] code · [x] unit-behavior · [ ] E2E · [ ] manual — tenant detail enriched (`sites`, `ownerInvite`) — `platform-tenants-get.spec.ts`, `platform-tenant-detail.spec.ts`
- [x] code · [x] unit-grep · [ ] E2E · [ ] manual — `PATCH …/status` + registry invalidation — `platform-tenant-status.spec.ts`, `platform-registry-cache.spec.ts`
- [x] code · [x] unit-grep · [ ] E2E · [ ] manual — platform audit `actorId` non-empty — `platform-audit-actor.spec.ts`

## Platform UI (admin host)

- [x] code · [x] unit-behavior · [x] E2E · [ ] manual — platform ops login → `platform_session` JWT — `platform-session-jwt.spec.ts`, E2E fixtures
- [x] code · [x] E2E · [ ] manual — create club 4-step wizard → club detail — `platform-create-club.spec.ts`
- [x] code · [x] unit-grep · [x] E2E · [ ] manual — club detail tabs (Overview · Sites · Domains · Owner · Actions) — `platform-club-detail-page.spec.ts`, `platform-ops-ui.spec.ts`
- [x] code · [x] unit-behavior · [x] E2E · [ ] manual — team page list + owner-only invite API — `platform-team-page.spec.ts`, `platform-team.spec.ts`, `platform-team-invite.spec.ts`

## Host & session isolation (EPIC E)

- [x] code · [x] unit-behavior · [x] E2E · [ ] manual — `admin.localhost` platform shell — `platform-host-isolation.spec.ts`
- [x] code · [x] unit-behavior · [x] E2E · [ ] manual — `{club}.admin.localhost` operator panel — `session-host-binding-multilevel.spec.ts`, `platform-owner-handoff.spec.ts`
- [x] code · [x] unit-behavior · [x] unit-grep · [ ] E2E · [ ] manual — platform session ≠ operator `session` cookie — `platform-session-cookie.spec.ts`

## Ops (EPIC F)

- [x] code · [x] unit-grep · [x] E2E · [ ] manual — custom domains API + Domains tab — `platform-tenants-domains.spec.ts`, `platform-ops-ui.spec.ts`
- [x] code · [x] unit-behavior · [x] E2E · [ ] manual — `sites/check` + overview stats (total + unhealthy) — `platform-sites-check-timeout.spec.ts`, `load-platform-overview-stats.spec.ts`, `platform-ops-ui.spec.ts`
- [x] code · [x] unit-grep · [x] E2E · [ ] manual — audit API + audit page — `platform-audit-list.spec.ts`, `platform-audit-page.spec.ts`, `platform-ops-ui.spec.ts`

## RBAC (EPIC G)

- [x] code · [x] unit-grep · [ ] E2E · [ ] manual — `platform_ops_users` schema + seed — `platform-ops-user-schema.spec.ts`, `scripts/seed-platform-ops.ts`
- [x] code · [x] unit-behavior · [ ] E2E · [ ] manual — DB role overrides env whitelist — `platform-auth-db-role.spec.ts`, `platform-ops-auth.spec.ts`
- [x] code · [x] unit-behavior · [ ] E2E · [ ] manual — support read-only; owner-only team POST — `platform-rbac.spec.ts`, `platform-team.spec.ts`
- [x] code · [x] unit-grep · [ ] E2E · [ ] manual — mutators use `assertPlatformOpsWriteRole` — `platform-rbac-coverage.spec.ts`

## E2E smokes (EPIC H)

- [x] code · [ ] unit-behavior · [ ] E2E · [x] manual/opt-in — live `smoke-platform-provision.mjs` asserts 201 — `pnpm run p1:live-smoke` (requires Postgres + API)
- [x] code · [x] unit-grep · [ ] E2E · [ ] manual — `smoke-platform-ui.mjs` structural
- [x] code · [x] E2E · [ ] manual — Playwright create club — `platform-create-club.spec.ts`
- [x] code · [x] E2E · [ ] manual — owner handoff → dashboard → wizard shell (+ optional Next) — `platform-owner-handoff.spec.ts`

## Product exit (§J — P1 closed · cross-app P2)

- [x] code · [x] E2E · [ ] manual — Denali club + wizard template seeded on provision — handoff template API assert + wizard loading shell E2E
- [x] code · [x] E2E · [ ] manual — 3 site URLs + health check **actionable** from UI — `platform-ops-ui.spec.ts`
- [x] code · [x] E2E · [ ] manual — owner invite → dashboard — `platform-owner-handoff.spec.ts`
- [x] code · [x] E2E · [ ] manual — owner invite → wizard shell (+ Next when host loads) — `platform-owner-handoff.spec.ts`
- [ ] Tour publish → Marketing catalog — **P2** (not P1)
- [ ] Portal registration end-to-end — **P2** (not P1)
- [x] code · [x] unit-behavior · [x] E2E · [ ] manual — suspend blocks operator login — `platform-suspend-blocks-login.spec.ts`, `platform-tenant-suspend-login.spec.ts`
- [x] code · [x] E2E · [ ] manual — suspend via platform UI — `platform-ops-ui.spec.ts`
- [x] code · [x] E2E · [ ] manual — overview KPIs (total + unhealthy) — `platform-ops-ui.spec.ts`
- [x] code · [x] E2E · [ ] manual — settings placeholder — `platform-ops-ui.spec.ts`
- [x] code · [x] unit-grep · [ ] E2E · [ ] manual — platform audit complete — `platform-audit-list.spec.ts`, `platform-ops-ui` TENANT_CREATED E2E
- [x] code · [x] unit-grep · [ ] E2E · [ ] manual — session platform ≠ operator isolated — EPIC E specs + separate cookies in E2E fixtures

## Deferred (P2 only)

- Tour publish → marketing catalog
- Portal registration end-to-end

## Gate commands

```bash
pnpm run p1:gate          # fast unit + structural
pnpm run p1:gate:full     # all platform unit specs
pnpm run p1:live-smoke    # opt-in live POST 201
pnpm run p1:e2e-gate      # Playwright 11/11 (Postgres + migrate)
```

## References

- Nano spec: `TEMP/p1-platform-control-center.md`
- Docs: `docs/phase-15/platform-control-center-{api,ui,ops}.mdoc`, `platform-host-multilevel.mdoc`
- Roadmap: `TEMP/ROADMAP-INDEX.md` — **P1 complete · P2 next**
