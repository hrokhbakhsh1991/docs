# P1 — Platform Control Center · Nano-Task Spec (v5.0 — AI Lite)

```yaml
version: 5.0-nano
nano_tasks: 264
appendix: full code for critical nanos
parent_tasks: 132
start: P1-N-001
```

---

## برای AI کوچک — فقط 5 قانون

1. **یک nano در هر بار** — N-001 بعد N-002 ...
2. **IMPLEMENT قبل از TEST** — هر parent دو nano: اول IMPLEMENT `[I]` بعد TEST `[T]`
3. **تست = حداقل 2 assert واقعی** — `assert.ok(true)` ممنوع
4. **VERIFY را بزن** — سبز نشد → STOP
5. **prod = `/platform/v1/tenants`** — نه `/internal/tenants/provision`

### Copy-paste: HTTP test helper (برای specهای API)

```typescript
import assert from "node:assert/strict";
import http from "node:http";
import { describe, it } from "node:test";
import { createRequestListener } from "../src/app";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";
installMemoryStorageDriverForDescribe();
async function platformHttpJson(method:"GET"|"POST", path:string, opts?:{headers?:Record<string,string>;body?:unknown}) {
  const listener = createRequestListener({ toursService: createTestToursService() });
  return new Promise<{status:number;body:Record<string,unknown>}>((resolve,reject)=>{
    const s=http.createServer(listener); s.listen(0,()=>{
      const a=s.address(); if(!a||typeof a==="string"){s.close();reject(new Error("no addr"));return;}
      const p=opts?.body?JSON.stringify(opts.body):undefined;
      const r=http.request({hostname:"127.0.0.1",port:a.port,path,method,headers:{...(opts?.headers??{}),...(p?{"Content-Type":"application/json","Content-Length":String(Buffer.byteLength(p))}:{})}},
      res=>{const c:Buffer[]=[];res.on("data",x=>c.push(x as Buffer));res.on("end",()=>{s.close();const t=Buffer.concat(c).toString("utf8");resolve({status:res.statusCode??0,body:t?JSON.parse(t):{}});});});
      r.on("error",e=>{s.close();reject(e);}); if(p)r.write(p); r.end();
    });
  });
}
function platformOpsHeaders(){return{Authorization:"Bearer test","X-Platform-Ops-Phone":"+989121234567"};}
```

---

## NANO TASKS (264)

### P1-N-001 [IMPLEMENT] `P1-T-001` — Create platform dir
- **EPIC:** P1-A
- **Deps:** `—`
- **Parent deps (graph):** `—`

**DO THIS:**

1. Run: `mkdir -p apps/api/src/platform`
2. Create `apps/api/src/platform/index.ts` with content:
```typescript
/** P1 platform module */
export {};
```

**DO NOT:** no business logic

**NEXT:** `P1-N-002`

**STATUS:** ✅ Done

---
### P1-N-002 [TEST] `P1-T-001` — Create platform dir
- **EPIC:** P1-A
- **Deps:** `P1-N-001`
- **Parent deps (graph):** `—`

**No test file.** Run verify only.

**VERIFY:** `test -f apps/api/src/platform/index.ts`

**PASS:** dir exists

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-003`

**STATUS:** ✅ Done

---
### P1-N-003 [IMPLEMENT] `P1-T-002` — Platform errors
- **EPIC:** P1-A
- **Deps:** `P1-N-002`
- **Parent deps (graph):** `T-001`

**DO THIS:**

1. Create `apps/api/src/platform/platform.errors.ts` — 3 classes each with readonly `code` string
2. Export from `index.ts`
3. Codes: PLATFORM_UNAUTHORIZED, PLATFORM_FORBIDDEN, PLATFORM_VALIDATION

**DO NOT:** plain Error

**NEXT:** `P1-N-004`

**STATUS:** ✅ Done

---
### P1-N-004 [TEST] `P1-T-002` — Platform errors
- **EPIC:** P1-A
- **Deps:** `P1-N-003`
- **Parent deps (graph):** `T-001`

**Create test file:** `apps/api/test/platform-errors.spec.ts`

**Required assertions (write real assert for each):**
- `PLATFORM_UNAUTHORIZED`
- `PLATFORM_FORBIDDEN`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-errors.spec.ts`

**PASS:** spec green

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-005`

---
### P1-N-005 [IMPLEMENT] `P1-T-003` — Error interceptor
- **EPIC:** P1-A
- **Deps:** `P1-N-004`
- **Parent deps (graph):** `T-002`

**DO THIS:**

**Files:** `error-interceptor.ts`

**Read:** `error-interceptor.ts`

**Steps:**
- map 401 403 422

**DO NOT:** 500 for platform errors

**NEXT:** `P1-N-006`

**STATUS:** ✅ Done

---
### P1-N-006 [TEST] `P1-T-003` — Error interceptor
- **EPIC:** P1-A
- **Deps:** `P1-N-005`
- **Parent deps (graph):** `T-002`

**Create test file:** `apps/api/test/platform-error-interceptor.spec.ts`

**Required assertions (write real assert for each):**
- `401 unauthorized`
- `422 validation`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-error-interceptor.spec.ts`

**PASS:** mapped

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-007`

---
### P1-N-007 [IMPLEMENT] `P1-T-004` — readPlatformOpsPhones
- **EPIC:** P1-A
- **Deps:** `P1-N-006`
- **Parent deps (graph):** `T-001`

**DO THIS:**

**Files:** `read-platform-ops-phones.ts`

**Read:** `—`

**Steps:**
- parse CSV env

**DO NOT:** hardcode phones

**NEXT:** `P1-N-008`

**STATUS:** ✅ Done

---
### P1-N-008 [TEST] `P1-T-004` — readPlatformOpsPhones
- **EPIC:** P1-A
- **Deps:** `P1-N-007`
- **Parent deps (graph):** `T-001`

**Create test file:** `apps/api/test/read-platform-ops-phones.spec.ts`

**Required assertions (write real assert for each):**
- `size 2`
- `size 0 empty`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/read-platform-ops-phones.spec.ts`

**PASS:** parser ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-009`

---
### P1-N-009 [IMPLEMENT] `P1-T-005` — assertPlatformOpsAuth
- **EPIC:** P1-A
- **Deps:** `P1-N-008`
- **Parent deps (graph):** `T-004`

**DO THIS:**

**Files:** `assert-platform-ops-auth.ts`

**Read:** `identity-otp.spec.ts`

**Steps:**
- auth guard

**DO NOT:** skip auth

**NEXT:** `P1-N-010`

**STATUS:** ✅ Done

---
### P1-N-010 [TEST] `P1-T-005` — assertPlatformOpsAuth
- **EPIC:** P1-A
- **Deps:** `P1-N-009`
- **Parent deps (graph):** `T-004`

**Create test file:** `apps/api/test/platform-ops-auth.spec.ts`

**Required assertions (write real assert for each):**
- `allowed`
- `401`
- `403`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-ops-auth.spec.ts`

**PASS:** 3 cases

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-011`

---
### P1-N-011 [IMPLEMENT] `P1-T-006` — PlatformAuthContext
- **EPIC:** P1-A
- **Deps:** `P1-N-010`
- **Parent deps (graph):** `T-005`

**DO THIS:**

**Files:** `platform-auth-context.ts`

**Read:** `—`

**Steps:**
- type + isPlatformWriteRole

**DO NOT:** any type

**NEXT:** `P1-N-012`

**STATUS:** ✅ Done

---
### P1-N-012 [TEST] `P1-T-006` — PlatformAuthContext
- **EPIC:** P1-A
- **Deps:** `P1-N-011`
- **Parent deps (graph):** `T-005`

**Create test file:** `apps/api/test/platform-auth-context.spec.ts`

**Required assertions (write real assert for each):**
- `owner true`
- `support false`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-auth-context.spec.ts`

**PASS:** helper ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-013`

---
### P1-N-013 [IMPLEMENT] `P1-T-007` — assertPlatformOpsWriteRole
- **EPIC:** P1-A
- **Deps:** `P1-N-012`
- **Parent deps (graph):** `T-006`

**DO THIS:**

**Files:** `assert-platform-ops-role.ts`

**Read:** `—`

**Steps:**
- support blocked

**DO NOT:** inline checks

**NEXT:** `P1-N-014`

**STATUS:** ✅ Done

---
### P1-N-014 [TEST] `P1-T-007` — assertPlatformOpsWriteRole
- **EPIC:** P1-A
- **Deps:** `P1-N-013`
- **Parent deps (graph):** `T-006`

**Create test file:** `apps/api/test/platform-ops-role.spec.ts`

**Required assertions (write real assert for each):**
- `support throws`
- `admin ok`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-ops-role.spec.ts`

**PASS:** guard ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-015`

---
### P1-N-015 [IMPLEMENT] `P1-T-008` — platform-route-registrar
- **EPIC:** P1-A
- **Deps:** `P1-N-014`
- **Parent deps (graph):** `T-002,T-005`

**DO THIS:**

**Files:** `platform-route-registrar.ts`

**Read:** `workspace-route-registrar.ts`

**Steps:**
- /platform/v1 prefix

**DO NOT:** no auth wrap

**NEXT:** `P1-N-016`

---
### P1-N-016 [TEST] `P1-T-008` — platform-route-registrar
- **EPIC:** P1-A
- **Deps:** `P1-N-015`
- **Parent deps (graph):** `T-002,T-005`

**Create test file:** `apps/api/test/platform-route-registrar.spec.ts`

**Required assertions (write real assert for each):**
- `contains prefix`
- `exports fn`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-route-registrar.spec.ts`

**PASS:** registrar ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-017`

---
### P1-N-017 [IMPLEMENT] `P1-T-009` — app.ts wire
- **EPIC:** P1-A
- **Deps:** `P1-N-016`
- **Parent deps (graph):** `T-008`

**DO THIS:**

**Files:** `app.ts`

**Read:** `app.ts`

**Steps:**
- dispatch platform routes

**DO NOT:** break internal

**NEXT:** `P1-N-018`

---
### P1-N-018 [TEST] `P1-T-009` — app.ts wire
- **EPIC:** P1-A
- **Deps:** `P1-N-017`
- **Parent deps (graph):** `T-008`

**Create test file:** `apps/api/test/platform-app-dispatch.spec.ts`

**Required assertions (write real assert for each):**
- `401`
- `404 unknown`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-app-dispatch.spec.ts`

**PASS:** wired

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-019`

---
### P1-N-019 [IMPLEMENT] `P1-T-010` — lazy handlers
- **EPIC:** P1-A
- **Deps:** `P1-N-018`
- **Parent deps (graph):** `T-008`

**DO THIS:**

**Files:** `lazy-route-handlers.ts`

**Read:** `—`

**Steps:**
- lazy platform import

**DO NOT:** eager import

**NEXT:** `P1-N-020`

---
### P1-N-020 [TEST] `P1-T-010` — lazy handlers
- **EPIC:** P1-A
- **Deps:** `P1-N-019`
- **Parent deps (graph):** `T-008`

**Create test file:** `apps/api/test/platform-lazy-handlers.spec.ts`

**Required assertions (write real assert for each):**
- `contains routes/platform`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-lazy-handlers.spec.ts`

**PASS:** lazy ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-021`

---
### P1-N-021 [IMPLEMENT] `P1-T-011` — listPlatformWorkspaces
- **EPIC:** P1-A
- **Deps:** `P1-N-020`
- **Parent deps (graph):** `T-001`

**DO THIS:**

**Files:** `list-platform-workspaces.ts`

**Read:** `workspace-plugin-registry.generated.ts`

**Steps:**
- denali in list

**DO NOT:** direct denali import

**NEXT:** `P1-N-022`

---
### P1-N-022 [TEST] `P1-T-011` — listPlatformWorkspaces
- **EPIC:** P1-A
- **Deps:** `P1-N-021`
- **Parent deps (graph):** `T-001`

**Create test file:** `apps/api/test/list-platform-workspaces.spec.ts`

**Required assertions (write real assert for each):**
- `id denali`
- `types array`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/list-platform-workspaces.spec.ts`

**PASS:** list ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-023`

---
### P1-N-023 [IMPLEMENT] `P1-T-012` — GET workspaces
- **EPIC:** P1-A
- **Deps:** `P1-N-022`
- **Parent deps (graph):** `T-005,T-011,T-008`

**DO THIS:**

**Files:** `routes/platform/workspaces.ts`

**Read:** `internal/tenants.ts`

**Steps:**
- handler 200

**DO NOT:** empty stub

**NEXT:** `P1-N-024`

---
### P1-N-024 [TEST] `P1-T-012` — GET workspaces
- **EPIC:** P1-A
- **Deps:** `P1-N-023`
- **Parent deps (graph):** `T-005,T-011,T-008`

**Create test file:** `apps/api/test/platform-workspaces.spec.ts`

**Required assertions (write real assert for each):**
- `200`
- `401`
- `has denali`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-workspaces.spec.ts`

**PASS:** HTTP ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-025`

---
### P1-N-025 [IMPLEMENT] `P1-T-013` — OpenAPI workspaces
- **EPIC:** P1-A
- **Deps:** `P1-N-024`
- **Parent deps (graph):** `T-012`

**DO THIS:**

**Files:** `openapi/dispatch-routes.ts`

**Read:** `—`

**Steps:**
- document path

**DO NOT:** —

**NEXT:** `P1-N-026`

---
### P1-N-026 [TEST] `P1-T-013` — OpenAPI workspaces
- **EPIC:** P1-A
- **Deps:** `P1-N-025`
- **Parent deps (graph):** `T-012`

**No test file.** Run verify only.

**VERIFY:** `grep platform/v1/workspaces apps/api/src/openapi/dispatch-routes.ts`

**PASS:** grep ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-027`

---
### P1-N-027 [IMPLEMENT] `P1-T-014` — PlatformTenantRepository
- **EPIC:** P1-A
- **Deps:** `P1-N-026`
- **Parent deps (graph):** `T-001`

**DO THIS:**

**Files:** `platform-tenant.repository.ts`

**Read:** `provisioning.service.ts`

**Steps:**
- list+get admin prisma

**DO NOT:** tenant RLS

**NEXT:** `P1-N-028`

---
### P1-N-028 [TEST] `P1-T-014` — PlatformTenantRepository
- **EPIC:** P1-A
- **Deps:** `P1-N-027`
- **Parent deps (graph):** `T-001`

**Create test file:** `apps/api/test/platform-tenant-repository.spec.ts`

**Required assertions (write real assert for each):**
- `in list`
- `null unknown`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-tenant-repository.spec.ts`

**PASS:** repo ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-029`

---
### P1-N-029 [IMPLEMENT] `P1-T-015` — GET tenants list
- **EPIC:** P1-A
- **Deps:** `P1-N-028`
- **Parent deps (graph):** `T-005,T-014,T-008`

**DO THIS:**

**Files:** `routes/platform/tenants-list.ts`

**Read:** `workspaces.ts`

**Steps:**
- paginated list

**DO NOT:** DEV only

**NEXT:** `P1-N-030`

---
### P1-N-030 [TEST] `P1-T-015` — GET tenants list
- **EPIC:** P1-A
- **Deps:** `P1-N-029`
- **Parent deps (graph):** `T-005,T-014,T-008`

**Create test file:** `apps/api/test/platform-tenants-list.spec.ts`

**Required assertions (write real assert for each):**
- `200 items`
- `401`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-tenants-list.spec.ts`

**PASS:** list ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-031`

---
### P1-N-031 [IMPLEMENT] `P1-T-016` — GET tenant by id
- **EPIC:** P1-A
- **Deps:** `P1-N-030`
- **Parent deps (graph):** `T-014,T-008`

**DO THIS:**

**Files:** `routes/platform/tenants-get.ts`

**Read:** `—`

**Steps:**
- 404+200

**DO NOT:** leak data

**NEXT:** `P1-N-032`

---
### P1-N-032 [TEST] `P1-T-016` — GET tenant by id
- **EPIC:** P1-A
- **Deps:** `P1-N-031`
- **Parent deps (graph):** `T-014,T-008`

**Create test file:** `apps/api/test/platform-tenants-get.spec.ts`

**Required assertions (write real assert for each):**
- `200 subdomain`
- `404 uuid`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-tenants-get.spec.ts`

**PASS:** get ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-033`

---
### P1-N-033 [IMPLEMENT] `P1-T-017` — platform tenant DTO
- **EPIC:** P1-A
- **Deps:** `P1-N-032`
- **Parent deps (graph):** `T-014`

**DO THIS:**

**Files:** `platform-tenant.dto.ts`

**Read:** `internal/tenants.ts`

**Steps:**
- toPlatformTenantDto

**DO NOT:** prisma leak

**NEXT:** `P1-N-034`

---
### P1-N-034 [TEST] `P1-T-017` — platform tenant DTO
- **EPIC:** P1-A
- **Deps:** `P1-N-033`
- **Parent deps (graph):** `T-014`

**Create test file:** `apps/api/test/platform-tenant-dto.spec.ts`

**Required assertions (write real assert for each):**
- `keys`
- `ISO date`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-tenant-dto.spec.ts`

**PASS:** dto ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-035`

---
### P1-N-035 [IMPLEMENT] `P1-T-018` — GATE A
- **EPIC:** P1-A
- **Deps:** `P1-N-034`
- **Parent deps (graph):** `T-012,T-015,T-016`

**DO THIS:**

**Files:** `—`

**Read:** `—`

**Steps:**
- run all A tests

**DO NOT:** start B if red

**NEXT:** `P1-N-036`

---
### P1-N-036 [TEST] `P1-T-018` — GATE A
- **EPIC:** P1-A
- **Deps:** `P1-N-035`
- **Parent deps (graph):** `T-012,T-015,T-016`

**No test file.** Run verify only.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-ops-auth.spec.ts test/platform-workspaces.spec.ts test/platform-tenants-list.spec.ts`

**PASS:** all green

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-037`

---
### P1-N-037 [IMPLEMENT] `P1-T-019` — createPlatformTenant Zod schema
- **EPIC:** P1-B
- **Deps:** `P1-N-036`
- **Parent deps (graph):** `T-002`

**DO THIS:**

**Files:** `apps/api/src/platform/create-platform-tenant.schema.ts`

**Read:** `apps/api/src/internal/provision-tenant.schema.ts`

**Steps:**
- Fields subdomain workspaceType ownerPhone ownerNameNote displayName theme strict

**DO NOT:** Reuse old schema without ownerPhone

**NEXT:** `P1-N-038`

---
### P1-N-038 [TEST] `P1-T-019` — createPlatformTenant Zod schema
- **EPIC:** P1-B
- **Deps:** `P1-N-037`
- **Parent deps (graph):** `T-002`

**Create test file:** `apps/api/test/create-platform-tenant-schema.spec.ts`

**Required assertions (write real assert for each):**
- `valid parses`
- `missing ownerPhone fails`
- `bad subdomain fails`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/create-platform-tenant-schema.spec.ts`

**PASS:** Schema complete

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-039`

---
### P1-N-039 [IMPLEMENT] `P1-T-020` — assertSubdomainAvailable
- **EPIC:** P1-B
- **Deps:** `P1-N-038`
- **Parent deps (graph):** `T-019`

**DO THIS:**

**Files:** `apps/api/src/platform/assert-subdomain-available.ts`

**Read:** `packages/tenant-kernel/src/host/constants.ts`

**Steps:**
- Regex+reserved+DB unique

**DO NOT:** Allow admin subdomain

**NEXT:** `P1-N-040`

---
### P1-N-040 [TEST] `P1-T-020` — assertSubdomainAvailable
- **EPIC:** P1-B
- **Deps:** `P1-N-039`
- **Parent deps (graph):** `T-019`

**Create test file:** `apps/api/test/platform-subdomain-guard.spec.ts`

**Required assertions (write real assert for each):**
- `admin fails`
- `valid-club passes`
- `duplicate fails`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-subdomain-guard.spec.ts`

**PASS:** Guard works

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-041`

---
### P1-N-041 [IMPLEMENT] `P1-T-021` — buildClubSiteUrls+readPlatformRootDomain
- **EPIC:** P1-B
- **Deps:** `P1-N-040`
- **Parent deps (graph):** `T-001`

**DO THIS:**

**Files:** `apps/api/src/platform/build-club-site-urls.ts;apps/api/src/platform/read-platform-root-domain.ts`

**Read:** `DEC-P1-020`

**Steps:**
- 3 URLs marketing portal admin/login

**DO NOT:** Operator on club apex

**NEXT:** `P1-N-042`

---
### P1-N-042 [TEST] `P1-T-021` — buildClubSiteUrls+readPlatformRootDomain
- **EPIC:** P1-B
- **Deps:** `P1-N-041`
- **Parent deps (graph):** `T-001`

**Create test file:** `apps/api/test/build-club-site-urls.spec.ts`

**Required assertions (write real assert for each):**
- `marketing apex`
- `portal .portal.`
- `admin .admin./auth/login`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/build-club-site-urls.spec.ts`

**PASS:** URLs correct

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-043`

---
### P1-N-043 [IMPLEMENT] `P1-T-022` — provisionTenantProduction
- **EPIC:** P1-B
- **Deps:** `P1-N-042`
- **Parent deps (graph):** `T-020`

**DO THIS:**

**Files:** `apps/api/src/internal/provisioning.service.ts`

**Read:** `provisioning-guard.ts`

**Steps:**
- New method without dev guard
- keep provisionTenant dev-only

**DO NOT:** Remove dev guard from old method

**NEXT:** `P1-N-044`

---
### P1-N-044 [TEST] `P1-T-022` — provisionTenantProduction
- **EPIC:** P1-B
- **Deps:** `P1-N-043`
- **Parent deps (graph):** `T-020`

**Create test file:** `apps/api/test/provision-tenant-production.spec.ts`

**Required assertions (write real assert for each):**
- `provisionTenant throws dev guard in prod`
- `production method succeeds`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/provision-tenant-production.spec.ts`

**PASS:** Split paths

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-045`

---
### P1-N-045 [IMPLEMENT] `P1-T-023` — runProvisionTransaction
- **EPIC:** P1-B
- **Deps:** `P1-N-044`
- **Parent deps (graph):** `T-022`

**DO THIS:**

**Files:** `apps/api/src/platform/run-provision-transaction.ts`

**Read:** `createTenantRow tx`

**Steps:**
- prisma $transaction wrapper

**DO NOT:** Commit outside tx

**NEXT:** `P1-N-046`

---
### P1-N-046 [TEST] `P1-T-023` — runProvisionTransaction
- **EPIC:** P1-B
- **Deps:** `P1-N-045`
- **Parent deps (graph):** `T-022`

**Create test file:** `apps/api/test/run-provision-transaction.spec.ts`

**Required assertions (write real assert for each):**
- `throw→no row`
- `success→row`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/run-provision-transaction.spec.ts`

**PASS:** Atomic tx

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-047`

---
### P1-N-047 [IMPLEMENT] `P1-T-024` — seedTenantBrandingConfig
- **EPIC:** P1-B
- **Deps:** `P1-N-046`
- **Parent deps (graph):** `T-023`

**DO THIS:**

**Files:** `apps/api/src/platform/seed-tenant-branding-config.ts`

**Read:** `workspace-default-tenant-branding.ts`

**Steps:**
- Upsert tenant_config branding

**DO NOT:** Skip branding

**NEXT:** `P1-N-048`

---
### P1-N-048 [TEST] `P1-T-024` — seedTenantBrandingConfig
- **EPIC:** P1-B
- **Deps:** `P1-N-047`
- **Parent deps (graph):** `T-023`

**Create test file:** `apps/api/test/seed-tenant-branding-config.spec.ts`

**Required assertions (write real assert for each):**
- `branding row exists`
- `has theme keys`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/seed-tenant-branding-config.spec.ts`

**PASS:** Branding seeded

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-049`

---
### P1-N-049 [IMPLEMENT] `P1-T-025` — seedTenantSiteSurfaces
- **EPIC:** P1-B
- **Deps:** `P1-N-048`
- **Parent deps (graph):** `T-023`

**DO THIS:**

**Files:** `apps/api/src/platform/seed-tenant-site-surfaces-config.ts`

**Read:** `TenantConfig`

**Steps:**
- Upsert site_surfaces all true

**DO NOT:** Hardcode false

**NEXT:** `P1-N-050`

---
### P1-N-050 [TEST] `P1-T-025` — seedTenantSiteSurfaces
- **EPIC:** P1-B
- **Deps:** `P1-N-049`
- **Parent deps (graph):** `T-023`

**Create test file:** `apps/api/test/seed-tenant-site-surfaces.spec.ts`

**Required assertions (write real assert for each):**
- `admin true`
- `marketing true`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/seed-tenant-site-surfaces.spec.ts`

**PASS:** Surfaces saved

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-051`

---
### P1-N-051 [IMPLEMENT] `P1-T-026` — seedWizardByWorkspaceType
- **EPIC:** P1-B
- **Deps:** `P1-N-050`
- **Parent deps (graph):** `T-023`

**DO THIS:**

**Files:** `apps/api/src/settings/seed-workspace-wizard-template.ts`

**Read:** `seed-urban-wizard-template.spec.ts`

**Steps:**
- seedWorkspaceWizardTemplateForWorkspaceType

**DO NOT:** Require dev tenantIds only

**NEXT:** `P1-N-052`

---
### P1-N-052 [TEST] `P1-T-026` — seedWizardByWorkspaceType
- **EPIC:** P1-B
- **Deps:** `P1-N-051`
- **Parent deps (graph):** `T-023`

**Create test file:** `apps/api/test/seed-workspace-wizard-by-type.spec.ts`

**Required assertions (write real assert for each):**
- `denali steps>=6 published`
- `idempotent skip`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/seed-workspace-wizard-by-type.spec.ts`

**PASS:** Wizard by type

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-053`

---
### P1-N-053 [IMPLEMENT] `P1-T-027` — PlatformAuditEvent schema
- **EPIC:** P1-B
- **Deps:** `P1-N-052`
- **Parent deps (graph):** `—`

**DO THIS:**

**Files:** `apps/api/prisma/schema.prisma;migration`

**Read:** `audit-logger.ts`

**Steps:**
- Add PlatformAuditEvent model+migrate

**DO NOT:** Mix with tenant audit

**NEXT:** `P1-N-054`

---
### P1-N-054 [TEST] `P1-T-027` — PlatformAuditEvent schema
- **EPIC:** P1-B
- **Deps:** `P1-N-053`
- **Parent deps (graph):** `—`

**Create test file:** `apps/api/test/platform-audit-schema.spec.ts`

**Required assertions (write real assert for each):**
- `can insert audit row`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-audit-schema.spec.ts`

**PASS:** Migration applied

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-055`

---
### P1-N-055 [IMPLEMENT] `P1-T-028` — appendPlatformAuditEvent
- **EPIC:** P1-B
- **Deps:** `P1-N-054`
- **Parent deps (graph):** `T-027`

**DO THIS:**

**Files:** `apps/api/src/platform/platform-audit-logger.ts`

**Read:** `audit-logger.ts`

**Steps:**
- TENANT_CREATED etc

**DO NOT:** Skip audit

**NEXT:** `P1-N-056`

---
### P1-N-056 [TEST] `P1-T-028` — appendPlatformAuditEvent
- **EPIC:** P1-B
- **Deps:** `P1-N-055`
- **Parent deps (graph):** `T-027`

**Create test file:** `apps/api/test/platform-audit-logger.spec.ts`

**Required assertions (write real assert for each):**
- `action persisted`
- `actorId set`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-audit-logger.spec.ts`

**PASS:** Logger works

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-057`

---
### P1-N-057 [IMPLEMENT] `P1-T-029` — inviteTenantOwner
- **EPIC:** P1-B
- **Deps:** `P1-N-056`
- **Parent deps (graph):** `T-023`

**DO THIS:**

**Files:** `apps/api/src/platform/invite-tenant-owner.ts`

**Read:** `createPendingInvite`

**Steps:**
- role owner via admin repo

**DO NOT:** Skip owner invite

**NEXT:** `P1-N-058`

---
### P1-N-058 [TEST] `P1-T-029` — inviteTenantOwner
- **EPIC:** P1-B
- **Deps:** `P1-N-057`
- **Parent deps (graph):** `T-023`

**Create test file:** `apps/api/test/platform-owner-invite.spec.ts`

**Required assertions (write real assert for each):**
- `pending invite owner role`
- `phone match`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-owner-invite.spec.ts`

**PASS:** Invite created

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-059`

---
### P1-N-059 [IMPLEMENT] `P1-T-030` — runProvisionTenantSaga
- **EPIC:** P1-B
- **Deps:** `P1-N-058`
- **Parent deps (graph):** `T-022,T-024,T-025,T-026,T-028,T-029`

**DO THIS:**

Create `provision-tenant-saga.ts` — IN ONE TRANSACTION:
1. provisionTenantProduction
2. seedTenantBrandingConfig
3. seedTenantSiteSurfacesConfig
4. seedWorkspaceWizardTemplateForWorkspaceType
5. appendPlatformAuditEvent TENANT_CREATED
6. inviteTenantOwner role=owner
After commit: invalidateTenantRegistryCache
Return {tenant,sites,invite}

**DO NOT:** Inline saga in handler;skip wizard

**NEXT:** `P1-N-060`

---
### P1-N-060 [TEST] `P1-T-030` — runProvisionTenantSaga
- **EPIC:** P1-B
- **Deps:** `P1-N-059`
- **Parent deps (graph):** `T-022,T-024,T-025,T-026,T-028,T-029`

**Create test file:** `apps/api/test/provision-tenant-saga.spec.ts`

**Required assertions (write real assert for each):**
- `tenant row`
- `2 configs`
- `wizard`
- `audit`
- `invite all exist`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/provision-tenant-saga.spec.ts`

**PASS:** Full saga

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-061`

---
### P1-N-061 [IMPLEMENT] `P1-T-031` — POST tenants idempotency
- **EPIC:** P1-B
- **Deps:** `P1-N-060`
- **Parent deps (graph):** `T-030`

**DO THIS:**

**Files:** `apps/api/src/routes/platform/tenants-create-idempotency.ts`

**Read:** `http-idempotency.ts`

**Steps:**
- Same key same response

**DO NOT:** Ignore header

**NEXT:** `P1-N-062`

---
### P1-N-062 [TEST] `P1-T-031` — POST tenants idempotency
- **EPIC:** P1-B
- **Deps:** `P1-N-061`
- **Parent deps (graph):** `T-030`

**Create test file:** `apps/api/test/platform-tenant-idempotency.spec.ts`

**Required assertions (write real assert for each):**
- `double POST same id`
- `same tenant id`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-tenant-idempotency.spec.ts`

**PASS:** Idempotent

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-063`

---
### P1-N-063 [IMPLEMENT] `P1-T-032` — POST /platform/v1/tenants handler
- **EPIC:** P1-B
- **Deps:** `P1-N-062`
- **Parent deps (graph):** `T-005,T-007,T-030,T-031`

**DO THIS:**

Create `tenants-create.ts`:
1. assertPlatformOpsAuth
2. assertPlatformOpsWriteRole
3. require Idempotency-Key header
4. parseCreatePlatformTenantBody
5. runProvisionTenantSaga
6. sendJson 201

**DO NOT:** Use internal route;201 without invite

**NEXT:** `P1-N-064`

---
### P1-N-064 [TEST] `P1-T-032` — POST /platform/v1/tenants handler
- **EPIC:** P1-B
- **Deps:** `P1-N-063`
- **Parent deps (graph):** `T-005,T-007,T-030,T-031`

**Create test file:** `apps/api/test/platform-provision.spec.ts`

**Required assertions (write real assert for each):**
- `201+subdomain+sites.admin+invite`
- `401`
- `support 403`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-provision.spec.ts`

**PASS:** HTTP provision

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-065`

---
### P1-N-065 [IMPLEMENT] `P1-T-033` — Wire POST in app+registrar
- **EPIC:** P1-B
- **Deps:** `P1-N-064`
- **Parent deps (graph):** `T-032,T-009`

**DO THIS:**

**Files:** `apps/api/src/app.ts;platform-route-registrar.ts`

**Read:** `T-009`

**Steps:**
- POST wired

**DO NOT:** Duplicate handler

**NEXT:** `P1-N-066`

---
### P1-N-066 [TEST] `P1-T-033` — Wire POST in app+registrar
- **EPIC:** P1-B
- **Deps:** `P1-N-065`
- **Parent deps (graph):** `T-032,T-009`

**Create test file:** `apps/api/test/platform-provision.spec.ts`

**Required assertions (write real assert for each):**
- `reuse T-032 all pass`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-provision.spec.ts`

**PASS:** Routed

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-067`

---
### P1-N-067 [IMPLEMENT] `P1-T-034` — OpenAPI POST tenants
- **EPIC:** P1-B
- **Deps:** `P1-N-066`
- **Parent deps (graph):** `T-032`

**DO THIS:**

**Files:** `apps/api/src/openapi/dispatch-routes.ts`

**Read:** `—`

**Steps:**
- Document POST

**DO NOT:** —

**NEXT:** `P1-N-068`

---
### P1-N-068 [TEST] `P1-T-034` — OpenAPI POST tenants
- **EPIC:** P1-B
- **Deps:** `P1-N-067`
- **Parent deps (graph):** `T-032`

**No test file.** Run verify only.

**VERIFY:** `grep POST platform/v1/tenants apps/api/src/openapi/dispatch-routes.ts`

**PASS:** OpenAPI

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-069`

---
### P1-N-069 [IMPLEMENT] `P1-T-035` — Deprecate internal provision
- **EPIC:** P1-B
- **Deps:** `P1-N-068`
- **Parent deps (graph):** `T-032`

**DO THIS:**

**Files:** `apps/api/src/routes/internal/tenants.ts`

**Read:** `—`

**Steps:**
- JSDoc points to /platform/v1

**DO NOT:** Remove internal route

**NEXT:** `P1-N-070`

---
### P1-N-070 [TEST] `P1-T-035` — Deprecate internal provision
- **EPIC:** P1-B
- **Deps:** `P1-N-069`
- **Parent deps (graph):** `T-032`

**Create test file:** `apps/api/test/platform-internal-deprecation.spec.ts`

**Required assertions (write real assert for each):**
- `file mentions platform/v1/tenants`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-internal-deprecation.spec.ts`

**PASS:** Deprecated

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-071`

---
### P1-N-071 [IMPLEMENT] `P1-T-036` — Cache invalidate on provision
- **EPIC:** P1-B
- **Deps:** `P1-N-070`
- **Parent deps (graph):** `T-030`

**DO THIS:**

**Files:** `provision-tenant-saga.ts`

**Read:** `tenant-registry-cache.ts`

**Steps:**
- invalidate after commit

**DO NOT:** Skip invalidate

**NEXT:** `P1-N-072`

---
### P1-N-072 [TEST] `P1-T-036` — Cache invalidate on provision
- **EPIC:** P1-B
- **Deps:** `P1-N-071`
- **Parent deps (graph):** `T-030`

**Create test file:** `apps/api/test/platform-registry-cache.spec.ts`

**Required assertions (write real assert for each):**
- `resolveBySubdomain finds tenant`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-registry-cache.spec.ts`

**PASS:** Cache ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-073`

---
### P1-N-073 [IMPLEMENT] `P1-T-037` — toCreateTenantResponse DTO
- **EPIC:** P1-B
- **Deps:** `P1-N-072`
- **Parent deps (graph):** `T-021,T-032`

**DO THIS:**

**Files:** `apps/api/src/platform/create-tenant-response.dto.ts`

**Read:** `—`

**Steps:**
- tenant+sites+invite shape

**DO NOT:** Leak token in list

**NEXT:** `P1-N-074`

---
### P1-N-074 [TEST] `P1-T-037` — toCreateTenantResponse DTO
- **EPIC:** P1-B
- **Deps:** `P1-N-073`
- **Parent deps (graph):** `T-021,T-032`

**Create test file:** `apps/api/test/create-tenant-response-dto.spec.ts`

**Required assertions (write real assert for each):**
- `3 top keys`
- `sites 3 urls`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/create-tenant-response-dto.spec.ts`

**PASS:** DTO ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-075`

---
### P1-N-075 [IMPLEMENT] `P1-T-038` — EPIC B gate
- **EPIC:** P1-B
- **Deps:** `P1-N-074`
- **Parent deps (graph):** `T-032,T-036`

**DO THIS:**

**Files:** `—`

**Read:** `G-B`

**Steps:**
- Run B specs

**DO NOT:** Start C if red

**NEXT:** `P1-N-076`

---
### P1-N-076 [TEST] `P1-T-038` — EPIC B gate
- **EPIC:** P1-B
- **Deps:** `P1-N-075`
- **Parent deps (graph):** `T-032,T-036`

**Create test file:** `apps/api/test/platform-epic-b.spec.ts`

**Required assertions (write real assert for each):**
- `provision flow assertions`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-provision.spec.ts test/platform-subdomain-guard.spec.ts test/platform-owner-invite.spec.ts`

**PASS:** G-B green

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-077`

---
### P1-N-077 [IMPLEMENT] `P1-T-039` — saga rollback test
- **EPIC:** P1-B
- **Deps:** `P1-N-076`
- **Parent deps (graph):** `T-030`

**DO THIS:**

**Files:** `apps/api/test/platform-saga-rollback.spec.ts`

**Read:** `saga`

**Steps:**
- Failure mid-seed no orphan

**DO NOT:** Leave orphan config

**NEXT:** `P1-N-078`

---
### P1-N-078 [TEST] `P1-T-039` — saga rollback test
- **EPIC:** P1-B
- **Deps:** `P1-N-077`
- **Parent deps (graph):** `T-030`

**Create test file:** `apps/api/test/platform-saga-rollback.spec.ts`

**Required assertions (write real assert for each):**
- `failure throws`
- `no partial config`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-saga-rollback.spec.ts`

**PASS:** Rollback

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-079`

---
### P1-N-079 [IMPLEMENT] `P1-T-040` — denali wizard on create
- **EPIC:** P1-B
- **Deps:** `P1-N-078`
- **Parent deps (graph):** `T-026,T-032`

**DO THIS:**

**Files:** `apps/api/test/platform-denali-wizard-seed.spec.ts`

**Read:** `seed spec`

**Steps:**
- POST denali wizard>=6 steps

**DO NOT:** Manual template only

**NEXT:** `P1-N-080`

---
### P1-N-080 [TEST] `P1-T-040` — denali wizard on create
- **EPIC:** P1-B
- **Deps:** `P1-N-079`
- **Parent deps (graph):** `T-026,T-032`

**Create test file:** `apps/api/test/platform-denali-wizard-seed.spec.ts`

**Required assertions (write real assert for each):**
- `published`
- `stepIds exist`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-denali-wizard-seed.spec.ts`

**PASS:** Denali seed

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-081`

---
### P1-N-081 [IMPLEMENT] `P1-T-041` — (platform) dir
- **EPIC:** P1-C
- **Deps:** `P1-N-080`
- **Parent deps (graph):** `T-038`

**DO THIS:**

**Files:** `apps/web/app/(platform)/`

**Read:** `—`

**Steps:**
- Create route group

**DO NOT:** Put operator routes here

**NEXT:** `P1-N-082`

---
### P1-N-082 [TEST] `P1-T-041` — (platform) dir
- **EPIC:** P1-C
- **Deps:** `P1-N-081`
- **Parent deps (graph):** `T-038`

**No test file.** Run verify only.

**VERIFY:** `test -d apps/web/app/(platform)`

**PASS:** Dir exists

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-083`

---
### P1-N-083 [IMPLEMENT] `P1-T-042` — platform layout
- **EPIC:** P1-C
- **Deps:** `P1-N-082`
- **Parent deps (graph):** `T-041`

**DO THIS:**

**Files:** `apps/web/app/(platform)/layout.tsx`

**Read:** `apps/web/app/(app)/layout.tsx`

**Steps:**
- Shell sidebar no denali ui

**DO NOT:** Copy operator sidebar

**NEXT:** `P1-N-084`

---
### P1-N-084 [TEST] `P1-T-042` — platform layout
- **EPIC:** P1-C
- **Deps:** `P1-N-083`
- **Parent deps (graph):** `T-041`

**Create test file:** `apps/web/test/platform-layout-boundary.spec.ts`

**Required assertions (write real assert for each):**
- `PATTERN-C no denali/ui`
- `has nav`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-layout-boundary.spec.ts`

**PASS:** Layout ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-085`

---
### P1-N-085 [IMPLEMENT] `P1-T-043` — platform-nav.ts
- **EPIC:** P1-C
- **Deps:** `P1-N-084`
- **Parent deps (graph):** `T-041`

**DO THIS:**

**Files:** `apps/web/src/platform/platform-nav.ts`

**Read:** `—`

**Steps:**
- 4 nav items /platform/*

**DO NOT:** Hardcode in pages

**NEXT:** `P1-N-086`

---
### P1-N-086 [TEST] `P1-T-043` — platform-nav.ts
- **EPIC:** P1-C
- **Deps:** `P1-N-085`
- **Parent deps (graph):** `T-041`

**Create test file:** `apps/web/test/platform-nav.spec.ts`

**Required assertions (write real assert for each):**
- `4 items`
- `clubs href`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-nav.spec.ts`

**PASS:** Nav ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-087`

---
### P1-N-087 [IMPLEMENT] `P1-T-044` — middleware platform host
- **EPIC:** P1-C
- **Deps:** `P1-N-086`
- **Parent deps (graph):** `T-041,T-005`

**DO THIS:**

**Files:** `apps/web/middleware.ts`

**Read:** `middleware.ts`

**Steps:**
- admin host branch

**DO NOT:** Break club middleware

**NEXT:** `P1-N-088`

---
### P1-N-088 [TEST] `P1-T-044` — middleware platform host
- **EPIC:** P1-C
- **Deps:** `P1-N-087`
- **Parent deps (graph):** `T-041,T-005`

**Create test file:** `apps/web/test/platform-middleware.spec.ts`

**Required assertions (write real assert for each):**
- `detect admin host`
- `platform branch`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-middleware.spec.ts`

**PASS:** Branch ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-089`

---
### P1-N-089 [IMPLEMENT] `P1-T-045` — requirePlatformOpsSession
- **EPIC:** P1-C
- **Deps:** `P1-N-088`
- **Parent deps (graph):** `T-044`

**DO THIS:**

**Files:** `apps/web/src/platform/require-platform-ops-session.ts`

**Read:** `require-operator-session.ts`

**Steps:**
- Redirect login

**DO NOT:** Same cookie as operator

**NEXT:** `P1-N-090`

---
### P1-N-090 [TEST] `P1-T-045` — requirePlatformOpsSession
- **EPIC:** P1-C
- **Deps:** `P1-N-089`
- **Parent deps (graph):** `T-044`

**Create test file:** `apps/web/test/require-platform-ops-session.spec.ts`

**Required assertions (write real assert for each):**
- `no session redirect`
- `session allowed`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/require-platform-ops-session.spec.ts`

**PASS:** Gate ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-091`

---
### P1-N-091 [IMPLEMENT] `P1-T-046` — platform login page
- **EPIC:** P1-C
- **Deps:** `P1-N-090`
- **Parent deps (graph):** `T-045`

**DO THIS:**

**Files:** `apps/web/app/(platform)/auth/login/page.tsx`

**Read:** `auth/login/page.tsx`

**Steps:**
- OTP reuse

**DO NOT:** Self-register

**NEXT:** `P1-N-092`

---
### P1-N-092 [TEST] `P1-T-046` — platform login page
- **EPIC:** P1-C
- **Deps:** `P1-N-091`
- **Parent deps (graph):** `T-045`

**Create test file:** `apps/web/test/platform-login-page.spec.ts`

**Required assertions (write real assert for each):**
- `imports login`
- `platform path`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-login-page.spec.ts`

**PASS:** Login ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-093`

---
### P1-N-093 [IMPLEMENT] `P1-T-047` — platform_session cookie
- **EPIC:** P1-C
- **Deps:** `P1-N-092`
- **Parent deps (graph):** `T-046`

**DO THIS:**

**Files:** `apps/web/src/platform/build-platform-session-cookie.ts`

**Read:** `build-session-cookie.ts`

**Steps:**
- Distinct cookie name

**DO NOT:** Overwrite operator cookie

**NEXT:** `P1-N-094`

---
### P1-N-094 [TEST] `P1-T-047` — platform_session cookie
- **EPIC:** P1-C
- **Deps:** `P1-N-093`
- **Parent deps (graph):** `T-046`

**Create test file:** `apps/web/test/platform-session-cookie.spec.ts`

**Required assertions (write real assert for each):**
- `name platform_session`
- `!=session`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-session-cookie.spec.ts`

**PASS:** Cookie ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-095`

---
### P1-N-095 [IMPLEMENT] `P1-T-048` — BFF GET workspaces
- **EPIC:** P1-C
- **Deps:** `P1-N-094`
- **Parent deps (graph):** `T-012,T-047`

**DO THIS:**

**Files:** `apps/web/app/api/platform/workspaces/route.ts`

**Read:** `users/route.ts`

**Steps:**
- Proxy GET

**DO NOT:** Call internal API

**NEXT:** `P1-N-096`

---
### P1-N-096 [TEST] `P1-T-048` — BFF GET workspaces
- **EPIC:** P1-C
- **Deps:** `P1-N-095`
- **Parent deps (graph):** `T-012,T-047`

**Create test file:** `apps/web/test/platform-bff-workspaces.spec.ts`

**Required assertions (write real assert for each):**
- `fetch platform/v1/workspaces`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-bff-workspaces.spec.ts`

**PASS:** BFF ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-097`

---
### P1-N-097 [IMPLEMENT] `P1-T-049` — BFF GET/POST tenants
- **EPIC:** P1-C
- **Deps:** `P1-N-096`
- **Parent deps (graph):** `T-015,T-032,T-047`

**DO THIS:**

**Files:** `apps/web/app/api/platform/tenants/route.ts`

**Read:** `T-048`

**Steps:**
- GET+POST forward Idempotency-Key

**DO NOT:** Strip headers

**NEXT:** `P1-N-098`

---
### P1-N-098 [TEST] `P1-T-049` — BFF GET/POST tenants
- **EPIC:** P1-C
- **Deps:** `P1-N-097`
- **Parent deps (graph):** `T-015,T-032,T-047`

**Create test file:** `apps/web/test/platform-bff-tenants.spec.ts`

**Required assertions (write real assert for each):**
- `POST forwards key`
- `GET list`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-bff-tenants.spec.ts`

**PASS:** BFF ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-099`

---
### P1-N-099 [IMPLEMENT] `P1-T-050` — platform-api-client
- **EPIC:** P1-C
- **Deps:** `P1-N-098`
- **Parent deps (graph):** `T-048`

**DO THIS:**

**Files:** `apps/web/src/platform/platform-api-client.ts`

**Read:** `—`

**Steps:**
- fetchPlatformApi helper

**DO NOT:** Direct API from browser

**NEXT:** `P1-N-100`

---
### P1-N-100 [TEST] `P1-T-050` — platform-api-client
- **EPIC:** P1-C
- **Deps:** `P1-N-099`
- **Parent deps (graph):** `T-048`

**Create test file:** `apps/web/test/platform-api-client.spec.ts`

**Required assertions (write real assert for each):**
- `/api/platform base`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-api-client.spec.ts`

**PASS:** Client ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-101`

---
### P1-N-101 [IMPLEMENT] `P1-T-051` — Overview page
- **EPIC:** P1-C
- **Deps:** `P1-N-100`
- **Parent deps (graph):** `T-042,T-045,T-049`

**DO THIS:**

**Files:** `apps/web/app/(platform)/page.tsx`

**Read:** `—`

**Steps:**
- KPI page

**DO NOT:** Client fetch API direct

**NEXT:** `P1-N-102`

---
### P1-N-102 [TEST] `P1-T-051` — Overview page
- **EPIC:** P1-C
- **Deps:** `P1-N-101`
- **Parent deps (graph):** `T-042,T-045,T-049`

**Create test file:** `apps/web/test/platform-overview-page.spec.ts`

**Required assertions (write real assert for each):**
- `imports stats helper`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-overview-page.spec.ts`

**PASS:** Overview ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-103`

---
### P1-N-103 [IMPLEMENT] `P1-T-052` — platform-overview-stats
- **EPIC:** P1-C
- **Deps:** `P1-N-102`
- **Parent deps (graph):** `T-049`

**DO THIS:**

**Files:** `apps/web/src/platform/platform-overview-stats.ts`

**Read:** `—`

**Steps:**
- total active suspended

**DO NOT:** Hardcode 0

**NEXT:** `P1-N-104`

---
### P1-N-104 [TEST] `P1-T-052` — platform-overview-stats
- **EPIC:** P1-C
- **Deps:** `P1-N-103`
- **Parent deps (graph):** `T-049`

**Create test file:** `apps/web/test/platform-overview-stats.spec.ts`

**Required assertions (write real assert for each):**
- `returns number fields`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-overview-stats.spec.ts`

**PASS:** Stats ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-105`

---
### P1-N-105 [IMPLEMENT] `P1-T-053` — Clubs list page
- **EPIC:** P1-C
- **Deps:** `P1-N-104`
- **Parent deps (graph):** `T-049,T-042`

**DO THIS:**

**Files:** `apps/web/app/(platform)/clubs/page.tsx`

**Read:** `—`

**Steps:**
- Table+CTA

**DO NOT:** Empty table no empty state

**NEXT:** `P1-N-106`

---
### P1-N-106 [TEST] `P1-T-053` — Clubs list page
- **EPIC:** P1-C
- **Deps:** `P1-N-105`
- **Parent deps (graph):** `T-049,T-042`

**Create test file:** `apps/web/test/platform-clubs-page.spec.ts`

**Required assertions (write real assert for each):**
- `imports table`
- `new link`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-clubs-page.spec.ts`

**PASS:** List ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-107`

---
### P1-N-107 [IMPLEMENT] `P1-T-054` — PlatformClubsTable
- **EPIC:** P1-C
- **Deps:** `P1-N-106`
- **Parent deps (graph):** `T-053`

**DO THIS:**

**Files:** `apps/web/src/platform/platform-clubs-table.tsx`

**Read:** `—`

**Steps:**
- subdomain status badge

**DO NOT:** Missing keys

**NEXT:** `P1-N-108`

---
### P1-N-108 [TEST] `P1-T-054` — PlatformClubsTable
- **EPIC:** P1-C
- **Deps:** `P1-N-107`
- **Parent deps (graph):** `T-053`

**Create test file:** `apps/web/test/platform-clubs-table.spec.ts`

**Required assertions (write real assert for each):**
- `renders subdomain`
- `suspended badge`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-clubs-table.spec.ts`

**PASS:** Table ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-109`

---
### P1-N-109 [IMPLEMENT] `P1-T-055` — create wizard route
- **EPIC:** P1-C
- **Deps:** `P1-N-108`
- **Parent deps (graph):** `T-042`

**DO THIS:**

**Files:** `apps/web/app/(platform)/clubs/new/page.tsx`

**Read:** `—`

**Steps:**
- Mount wizard

**DO NOT:** All steps in page

**NEXT:** `P1-N-110`

---
### P1-N-110 [TEST] `P1-T-055` — create wizard route
- **EPIC:** P1-C
- **Deps:** `P1-N-109`
- **Parent deps (graph):** `T-042`

**Create test file:** `apps/web/test/platform-create-route.spec.ts`

**Required assertions (write real assert for each):**
- `imports wizard hook`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-create-route.spec.ts`

**PASS:** Route ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-111`

---
### P1-N-111 [IMPLEMENT] `P1-T-056` — use-create-club-wizard
- **EPIC:** P1-C
- **Deps:** `P1-N-110`
- **Parent deps (graph):** `T-055`

**DO THIS:**

**Files:** `apps/web/src/platform/create-club/use-create-club-wizard.ts`

**Read:** `—`

**Steps:**
- 4 step state machine

**DO NOT:** No validation

**NEXT:** `P1-N-112`

---
### P1-N-112 [TEST] `P1-T-056` — use-create-club-wizard
- **EPIC:** P1-C
- **Deps:** `P1-N-111`
- **Parent deps (graph):** `T-055`

**Create test file:** `apps/web/test/use-create-club-wizard.spec.ts`

**Required assertions (write real assert for each):**
- `step1 initial`
- `next increments`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/use-create-club-wizard.spec.ts`

**PASS:** Hook ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-113`

---
### P1-N-113 [IMPLEMENT] `P1-T-057` — step-identity
- **EPIC:** P1-C
- **Deps:** `P1-N-112`
- **Parent deps (graph):** `T-056,T-048`

**DO THIS:**

**Files:** `apps/web/src/platform/create-club/step-identity.tsx`

**Read:** `—`

**Steps:**
- name subdomain workspace

**DO NOT:** Free workspace text

**NEXT:** `P1-N-114`

---
### P1-N-114 [TEST] `P1-T-057` — step-identity
- **EPIC:** P1-C
- **Deps:** `P1-N-113`
- **Parent deps (graph):** `T-056,T-048`

**Create test file:** `apps/web/test/step-identity.spec.ts`

**Required assertions (write real assert for each):**
- `workspace options>=1`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/step-identity.spec.ts`

**PASS:** Step1 ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-115`

---
### P1-N-115 [IMPLEMENT] `P1-T-058` — validate-subdomain client
- **EPIC:** P1-C
- **Deps:** `P1-N-114`
- **Parent deps (graph):** `T-020,T-057`

**DO THIS:**

**Files:** `apps/web/src/platform/create-club/validate-subdomain.ts`

**Read:** `assert-subdomain-available.ts`

**Steps:**
- Mirror server rules

**DO NOT:** Server only

**NEXT:** `P1-N-116`

---
### P1-N-116 [TEST] `P1-T-058` — validate-subdomain client
- **EPIC:** P1-C
- **Deps:** `P1-N-115`
- **Parent deps (graph):** `T-020,T-057`

**Create test file:** `apps/web/test/platform-subdomain-validator.spec.ts`

**Required assertions (write real assert for each):**
- `admin invalid`
- `alborz valid`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-subdomain-validator.spec.ts`

**PASS:** Client valid

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-117`

---
### P1-N-117 [IMPLEMENT] `P1-T-059` — step-sites preview
- **EPIC:** P1-C
- **Deps:** `P1-N-116`
- **Parent deps (graph):** `T-057,T-021`

**DO THIS:**

**Files:** `apps/web/src/platform/create-club/step-sites.tsx`

**Read:** `—`

**Steps:**
- 3 URL preview

**DO NOT:** Editable URLs

**NEXT:** `P1-N-118`

---
### P1-N-118 [TEST] `P1-T-059` — step-sites preview
- **EPIC:** P1-C
- **Deps:** `P1-N-117`
- **Parent deps (graph):** `T-057,T-021`

**Create test file:** `apps/web/test/step-sites.spec.ts`

**Required assertions (write real assert for each):**
- `.admin.`
- `.portal.`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/step-sites.spec.ts`

**PASS:** Step2 ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-119`

---
### P1-N-119 [IMPLEMENT] `P1-T-060` — step-owner
- **EPIC:** P1-C
- **Deps:** `P1-N-118`
- **Parent deps (graph):** `T-056`

**DO THIS:**

**Files:** `apps/web/src/platform/create-club/step-owner.tsx`

**Read:** `—`

**Steps:**
- phone required

**DO NOT:** Skip phone

**NEXT:** `P1-N-120`

---
### P1-N-120 [TEST] `P1-T-060` — step-owner
- **EPIC:** P1-C
- **Deps:** `P1-N-119`
- **Parent deps (graph):** `T-056`

**Create test file:** `apps/web/test/step-owner.spec.ts`

**Required assertions (write real assert for each):**
- `empty phone error`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/step-owner.spec.ts`

**PASS:** Step3 ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-121`

---
### P1-N-121 [IMPLEMENT] `P1-T-061` — step-review submit
- **EPIC:** P1-C
- **Deps:** `P1-N-120`
- **Parent deps (graph):** `T-050,T-056,T-060`

**DO THIS:**

**Files:** `apps/web/src/platform/create-club/step-review.tsx`

**Read:** `—`

**Steps:**
- POST+Idempotency-Key

**DO NOT:** No idempotency key

**NEXT:** `P1-N-122`

---
### P1-N-122 [TEST] `P1-T-061` — step-review submit
- **EPIC:** P1-C
- **Deps:** `P1-N-121`
- **Parent deps (graph):** `T-050,T-056,T-060`

**Create test file:** `apps/web/test/step-review.spec.ts`

**Required assertions (write real assert for each):**
- `uuid key`
- `POST on confirm`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/step-review.spec.ts`

**PASS:** Submit ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-123`

---
### P1-N-123 [IMPLEMENT] `P1-T-062` — success redirect
- **EPIC:** P1-C
- **Deps:** `P1-N-122`
- **Parent deps (graph):** `T-061`

**DO THIS:**

**Files:** `step-review.tsx MOD`

**Read:** `—`

**Steps:**
- 201→/platform/clubs/id

**DO NOT:** Stay on review

**NEXT:** `P1-N-124`

---
### P1-N-124 [TEST] `P1-T-062` — success redirect
- **EPIC:** P1-C
- **Deps:** `P1-N-123`
- **Parent deps (graph):** `T-061`

**Create test file:** `apps/web/test/create-club-redirect.spec.ts`

**Required assertions (write real assert for each):**
- `path has id`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/create-club-redirect.spec.ts`

**PASS:** Redirect ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-125`

---
### P1-N-125 [IMPLEMENT] `P1-T-063` — EPIC C boundary
- **EPIC:** P1-C
- **Deps:** `P1-N-124`
- **Parent deps (graph):** `T-042,T-048`

**DO THIS:**

**Files:** `apps/web/test/platform-epic-c-boundary.spec.ts`

**Read:** `PATTERN-C`

**Steps:**
- No denali in platform tree

**DO NOT:** Start D if red

**NEXT:** `P1-N-126`

---
### P1-N-126 [TEST] `P1-T-063` — EPIC C boundary
- **EPIC:** P1-C
- **Deps:** `P1-N-125`
- **Parent deps (graph):** `T-042,T-048`

**Create test file:** `apps/web/test/platform-epic-c-boundary.spec.ts`

**Required assertions (write real assert for each):**
- `scan passes`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-nav.spec.ts test/platform-subdomain-validator.spec.ts test/platform-layout-boundary.spec.ts`

**PASS:** G-C green

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-127`

---
### P1-N-127 [IMPLEMENT] `P1-T-064` — platform auth BFF
- **EPIC:** P1-C
- **Deps:** `P1-N-126`
- **Parent deps (graph):** `T-046,T-005`

**DO THIS:**

**Files:** `apps/web/app/api/platform/auth/login/route.ts`

**Read:** `login-web-session`

**Steps:**
- Proxy platform OTP

**DO NOT:** Shared endpoint no host check

**NEXT:** `P1-N-128`

---
### P1-N-128 [TEST] `P1-T-064` — platform auth BFF
- **EPIC:** P1-C
- **Deps:** `P1-N-127`
- **Parent deps (graph):** `T-046,T-005`

**Create test file:** `apps/web/test/platform-auth-bff.spec.ts`

**Required assertions (write real assert for each):**
- `POST export`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-auth-bff.spec.ts`

**PASS:** Auth BFF

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-129`

---
### P1-N-129 [IMPLEMENT] `P1-T-065` — async states UI
- **EPIC:** P1-C
- **Deps:** `P1-N-128`
- **Parent deps (graph):** `T-053,T-061`

**DO THIS:**

**Files:** `apps/web/src/platform/platform-async-states.tsx`

**Read:** `—`

**Steps:**
- Loading Error Empty

**DO NOT:** Blank on error

**NEXT:** `P1-N-130`

---
### P1-N-130 [TEST] `P1-T-065` — async states UI
- **EPIC:** P1-C
- **Deps:** `P1-N-129`
- **Parent deps (graph):** `T-053,T-061`

**Create test file:** `apps/web/test/platform-async-states.spec.ts`

**Required assertions (write real assert for each):**
- `3 exports`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-async-states.spec.ts`

**PASS:** UX ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-131`

---
### P1-N-131 [IMPLEMENT] `P1-T-066` — smoke create script
- **EPIC:** P1-C
- **Deps:** `P1-N-130`
- **Parent deps (graph):** `T-062`

**DO THIS:**

**Files:** `apps/web/scripts/smoke-platform-create-club.mjs`

**Read:** `—`

**Steps:**
- Document smoke steps

**DO NOT:** —

**NEXT:** `P1-N-132`

---
### P1-N-132 [TEST] `P1-T-066` — smoke create script
- **EPIC:** P1-C
- **Deps:** `P1-N-131`
- **Parent deps (graph):** `T-062`

**No test file.** Run verify only.

**VERIFY:** `test -f apps/web/scripts/smoke-platform-create-club.mjs`

**PASS:** Script exists

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-133`

---
### P1-N-133 [IMPLEMENT] `P1-T-067` — nav path prefix
- **EPIC:** P1-C
- **Deps:** `P1-N-132`
- **Parent deps (graph):** `T-043`

**DO THIS:**

**Files:** `platform-nav.ts`

**Read:** `—`

**Steps:**
- All /platform prefix

**DO NOT:** Mixed prefix

**NEXT:** `P1-N-134`

---
### P1-N-134 [TEST] `P1-T-067` — nav path prefix
- **EPIC:** P1-C
- **Deps:** `P1-N-133`
- **Parent deps (graph):** `T-043`

**Create test file:** `apps/web/test/platform-nav.spec.ts`

**Required assertions (write real assert for each):**
- `all hrefs /platform*`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-nav.spec.ts`

**PASS:** Paths ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-135`

---
### P1-N-135 [IMPLEMENT] `P1-T-068` — EPIC C gate
- **EPIC:** P1-C
- **Deps:** `P1-N-134`
- **Parent deps (graph):** `T-063`

**DO THIS:**

**Files:** `—`

**Read:** `G-C`

**Steps:**
- Run C specs

**DO NOT:** Proceed if red

**NEXT:** `P1-N-136`

---
### P1-N-136 [TEST] `P1-T-068` — EPIC C gate
- **EPIC:** P1-C
- **Deps:** `P1-N-135`
- **Parent deps (graph):** `T-063`

**No test file.** Run verify only.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-nav.spec.ts test/platform-subdomain-validator.spec.ts`

**PASS:** G-C pass

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-137`

---
### P1-N-137 [IMPLEMENT] `P1-T-069` — club detail page
- **EPIC:** P1-D
- **Deps:** `P1-N-136`
- **Parent deps (graph):** `T-053,T-072`

**DO THIS:**

**Files:** `apps/web/app/(platform)/clubs/[id]/page.tsx`

**Read:** `—`

**Steps:**
- Load tenant 404

**DO NOT:** Crash unknown id

**NEXT:** `P1-N-138`

---
### P1-N-138 [TEST] `P1-T-069` — club detail page
- **EPIC:** P1-D
- **Deps:** `P1-N-137`
- **Parent deps (graph):** `T-053,T-072`

**Create test file:** `apps/web/test/platform-club-detail-page.spec.ts`

**Required assertions (write real assert for each):**
- `tabs import`
- `id param`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-club-detail-page.spec.ts`

**PASS:** Detail ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-139`

---
### P1-N-139 [IMPLEMENT] `P1-T-070` — club-tabs
- **EPIC:** P1-D
- **Deps:** `P1-N-138`
- **Parent deps (graph):** `T-069`

**DO THIS:**

**Files:** `apps/web/src/platform/club-detail/club-tabs.tsx`

**Read:** `—`

**Steps:**
- 4 tabs

**DO NOT:** Hide domains

**NEXT:** `P1-N-140`

---
### P1-N-140 [TEST] `P1-T-070` — club-tabs
- **EPIC:** P1-D
- **Deps:** `P1-N-139`
- **Parent deps (graph):** `T-069`

**Create test file:** `apps/web/test/club-tabs.spec.ts`

**Required assertions (write real assert for each):**
- `Profile Sites Domains Owner`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/club-tabs.spec.ts`

**PASS:** Tabs ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-141`

---
### P1-N-141 [IMPLEMENT] `P1-T-071` — tab-profile
- **EPIC:** P1-D
- **Deps:** `P1-N-140`
- **Parent deps (graph):** `T-070,T-072`

**DO THIS:**

**Files:** `tab-profile.tsx`

**Read:** `—`

**Steps:**
- fields+suspend btn

**DO NOT:** Edit subdomain

**NEXT:** `P1-N-142`

---
### P1-N-142 [TEST] `P1-T-071` — tab-profile
- **EPIC:** P1-D
- **Deps:** `P1-N-141`
- **Parent deps (graph):** `T-070,T-072`

**Create test file:** `apps/web/test/tab-profile.spec.ts`

**Required assertions (write real assert for each):**
- `subdomain render`
- `suspend btn`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/tab-profile.spec.ts`

**PASS:** Profile ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-143`

---
### P1-N-143 [IMPLEMENT] `P1-T-072` — BFF GET tenant
- **EPIC:** P1-D
- **Deps:** `P1-N-142`
- **Parent deps (graph):** `T-016,T-047`

**DO THIS:**

**Files:** `apps/web/app/api/platform/tenants/[id]/route.ts`

**Read:** `T-049`

**Steps:**
- GET proxy

**DO NOT:** Raw prisma

**NEXT:** `P1-N-144`

---
### P1-N-144 [TEST] `P1-T-072` — BFF GET tenant
- **EPIC:** P1-D
- **Deps:** `P1-N-143`
- **Parent deps (graph):** `T-016,T-047`

**Create test file:** `apps/web/test/platform-bff-tenant-get.spec.ts`

**Required assertions (write real assert for each):**
- `GET export`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-bff-tenant-get.spec.ts`

**PASS:** BFF ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-145`

---
### P1-N-145 [IMPLEMENT] `P1-T-073` — GET tenants/:id/sites API
- **EPIC:** P1-D
- **Deps:** `P1-N-144`
- **Parent deps (graph):** `T-021,T-025,T-032`

**DO THIS:**

**Files:** `apps/api/src/routes/platform/tenants-sites.ts`

**Read:** `build-club-site-urls`

**Steps:**
- Auth+URLs+surfaces

**DO NOT:** Omit admin

**NEXT:** `P1-N-146`

---
### P1-N-146 [TEST] `P1-T-073` — GET tenants/:id/sites API
- **EPIC:** P1-D
- **Deps:** `P1-N-145`
- **Parent deps (graph):** `T-021,T-025,T-032`

**Create test file:** `apps/api/test/platform-tenants-sites.spec.ts`

**Required assertions (write real assert for each):**
- `3 keys`
- `admin /auth/login`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-tenants-sites.spec.ts`

**PASS:** Sites API

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-147`

---
### P1-N-147 [IMPLEMENT] `P1-T-074` — BFF sites
- **EPIC:** P1-D
- **Deps:** `P1-N-146`
- **Parent deps (graph):** `T-073`

**DO THIS:**

**Files:** `apps/web/app/api/platform/tenants/[id]/sites/route.ts`

**Read:** `—`

**Steps:**
- GET proxy

**DO NOT:** Hardcode URLs

**NEXT:** `P1-N-148`

---
### P1-N-148 [TEST] `P1-T-074` — BFF sites
- **EPIC:** P1-D
- **Deps:** `P1-N-147`
- **Parent deps (graph):** `T-073`

**Create test file:** `apps/web/test/platform-bff-sites.spec.ts`

**Required assertions (write real assert for each):**
- `GET export`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-bff-sites.spec.ts`

**PASS:** BFF ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-149`

---
### P1-N-149 [IMPLEMENT] `P1-T-075` — tab-sites UI
- **EPIC:** P1-D
- **Deps:** `P1-N-148`
- **Parent deps (graph):** `T-074,T-070`

**DO THIS:**

**Files:** `tab-sites.tsx`

**Read:** `—`

**Steps:**
- 3 links copy

**DO NOT:** Apex as admin

**NEXT:** `P1-N-150`

---
### P1-N-150 [TEST] `P1-T-075` — tab-sites UI
- **EPIC:** P1-D
- **Deps:** `P1-N-149`
- **Parent deps (graph):** `T-074,T-070`

**Create test file:** `apps/web/test/tab-sites.spec.ts`

**Required assertions (write real assert for each):**
- `3 hrefs`
- `copy fn`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/tab-sites.spec.ts`

**PASS:** Sites UI

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-151`

---
### P1-N-151 [IMPLEMENT] `P1-T-076` — GET owner invites
- **EPIC:** P1-D
- **Deps:** `P1-N-150`
- **Parent deps (graph):** `T-029`

**DO THIS:**

**Files:** `tenants-owner-invites.ts`

**Read:** `—`

**Steps:**
- List pending

**DO NOT:** Expose tokens

**NEXT:** `P1-N-152`

---
### P1-N-152 [TEST] `P1-T-076` — GET owner invites
- **EPIC:** P1-D
- **Deps:** `P1-N-151`
- **Parent deps (graph):** `T-029`

**Create test file:** `apps/api/test/platform-owner-invites-list.spec.ts`

**Required assertions (write real assert for each):**
- `owner invite in list`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-owner-invites-list.spec.ts`

**PASS:** List ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-153`

---
### P1-N-153 [IMPLEMENT] `P1-T-077` — POST resend invite
- **EPIC:** P1-D
- **Deps:** `P1-N-152`
- **Parent deps (graph):** `T-029`

**DO THIS:**

**Files:** `tenants-owner-invite-resend.ts`

**Read:** `—`

**Steps:**
- Idempotent resend

**DO NOT:** Duplicate owner

**NEXT:** `P1-N-154`

---
### P1-N-154 [TEST] `P1-T-077` — POST resend invite
- **EPIC:** P1-D
- **Deps:** `P1-N-153`
- **Parent deps (graph):** `T-029`

**Create test file:** `apps/api/test/platform-owner-invite-resend.spec.ts`

**Required assertions (write real assert for each):**
- `POST ok`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-owner-invite-resend.spec.ts`

**PASS:** Resend ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-155`

---
### P1-N-155 [IMPLEMENT] `P1-T-078` — tab-owner
- **EPIC:** P1-D
- **Deps:** `P1-N-154`
- **Parent deps (graph):** `T-076,T-077`

**DO THIS:**

**Files:** `tab-owner.tsx`

**Read:** `—`

**Steps:**
- pending+resend

**DO NOT:** Show token

**NEXT:** `P1-N-156`

---
### P1-N-156 [TEST] `P1-T-078` — tab-owner
- **EPIC:** P1-D
- **Deps:** `P1-N-155`
- **Parent deps (graph):** `T-076,T-077`

**Create test file:** `apps/web/test/tab-owner.spec.ts`

**Required assertions (write real assert for each):**
- `resend POST`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/tab-owner.spec.ts`

**PASS:** Owner tab

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-157`

---
### P1-N-157 [IMPLEMENT] `P1-T-079` — POST suspend
- **EPIC:** P1-D
- **Deps:** `P1-N-156`
- **Parent deps (graph):** `T-028,T-014`

**DO THIS:**

**Files:** `tenants-suspend.ts`

**Read:** `—`

**Steps:**
- status+audit+cache

**DO NOT:** Delete tenant

**NEXT:** `P1-N-158`

---
### P1-N-158 [TEST] `P1-T-079` — POST suspend
- **EPIC:** P1-D
- **Deps:** `P1-N-157`
- **Parent deps (graph):** `T-028,T-014`

**Create test file:** `apps/api/test/platform-suspend.spec.ts`

**Required assertions (write real assert for each):**
- `status suspended`
- `audit row`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-suspend.spec.ts`

**PASS:** Suspend ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-159`

---
### P1-N-159 [IMPLEMENT] `P1-T-080` — POST activate
- **EPIC:** P1-D
- **Deps:** `P1-N-158`
- **Parent deps (graph):** `T-079`

**DO THIS:**

**Files:** `tenants-activate.ts`

**Read:** `—`

**Steps:**
- active+audit

**DO NOT:** Skip audit

**NEXT:** `P1-N-160`

---
### P1-N-160 [TEST] `P1-T-080` — POST activate
- **EPIC:** P1-D
- **Deps:** `P1-N-159`
- **Parent deps (graph):** `T-079`

**Create test file:** `apps/api/test/platform-activate.spec.ts`

**Required assertions (write real assert for each):**
- `reactivate active`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-activate.spec.ts`

**PASS:** Activate ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-161`

---
### P1-N-161 [IMPLEMENT] `P1-T-081` — BFF suspend/activate
- **EPIC:** P1-D
- **Deps:** `P1-N-160`
- **Parent deps (graph):** `T-079,T-080`

**DO THIS:**

**Files:** `suspend/route.ts;activate/route.ts`

**Read:** `—`

**Steps:**
- POST proxies

**DO NOT:** GET mutate

**NEXT:** `P1-N-162`

---
### P1-N-162 [TEST] `P1-T-081` — BFF suspend/activate
- **EPIC:** P1-D
- **Deps:** `P1-N-161`
- **Parent deps (graph):** `T-079,T-080`

**Create test file:** `apps/web/test/platform-bff-lifecycle.spec.ts`

**Required assertions (write real assert for each):**
- `both routes POST`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-bff-lifecycle.spec.ts`

**PASS:** BFF ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-163`

---
### P1-N-163 [IMPLEMENT] `P1-T-082` — suspend UI
- **EPIC:** P1-D
- **Deps:** `P1-N-162`
- **Parent deps (graph):** `T-081,T-071`

**DO THIS:**

**Files:** `tab-profile MODIFY`

**Read:** `—`

**Steps:**
- confirm+refresh

**DO NOT:** No confirm

**NEXT:** `P1-N-164`

---
### P1-N-164 [TEST] `P1-T-082` — suspend UI
- **EPIC:** P1-D
- **Deps:** `P1-N-163`
- **Parent deps (graph):** `T-081,T-071`

**Create test file:** `apps/web/test/tab-profile-suspend.spec.ts`

**Required assertions (write real assert for each):**
- `POST on confirm`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/tab-profile-suspend.spec.ts`

**PASS:** UI ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-165`

---
### P1-N-165 [IMPLEMENT] `P1-T-083` — block suspended operator
- **EPIC:** P1-D
- **Deps:** `P1-N-164`
- **Parent deps (graph):** `T-079`

**DO THIS:**

**Files:** `middleware.ts;api middleware`

**Read:** `—`

**Steps:**
- suspended→block

**DO NOT:** Tours on suspended

**NEXT:** `P1-N-166`

---
### P1-N-166 [TEST] `P1-T-083` — block suspended operator
- **EPIC:** P1-D
- **Deps:** `P1-N-165`
- **Parent deps (graph):** `T-079`

**Create test file:** `apps/api/test/platform-suspended-operator-block.spec.ts`

**Required assertions (write real assert for each):**
- `operator blocked`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-suspended-operator-block.spec.ts`

**PASS:** Block ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-167`

---
### P1-N-167 [IMPLEMENT] `P1-T-084` — EPIC D gate
- **EPIC:** P1-D
- **Deps:** `P1-N-166`
- **Parent deps (graph):** `T-079,T-083`

**DO THIS:**

**Files:** `—`

**Read:** `G-D`

**Steps:**
- Run D specs

**DO NOT:** Start E if red

**NEXT:** `P1-N-168`

---
### P1-N-168 [TEST] `P1-T-084` — EPIC D gate
- **EPIC:** P1-D
- **Deps:** `P1-N-167`
- **Parent deps (graph):** `T-079,T-083`

**No test file.** Run verify only.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-suspend.spec.ts test/platform-tenants-sites.spec.ts`

**PASS:** G-D green

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-169`

---
### P1-N-169 [IMPLEMENT] `P1-T-085` — parseMultiLevelTenantHost
- **EPIC:** P1-E
- **Deps:** `P1-N-168`
- **Parent deps (graph):** `T-038`

**DO THIS:**

**Files:** `packages/tenant-kernel/src/host/parse-multi-level-tenant-host.ts`

**Read:** `parse-workspace-tenant-label.ts`

**Steps:**
- PATTERN-D parser

**DO NOT:** Break single-level

**NEXT:** `P1-N-170`

---
### P1-N-170 [TEST] `P1-T-085` — parseMultiLevelTenantHost
- **EPIC:** P1-E
- **Deps:** `P1-N-169`
- **Parent deps (graph):** `T-038`

**Create test file:** `packages/tenant-kernel/test/multi-level-host-parse.spec.ts`

**Required assertions (write real assert for each):**
- `platform admin`
- `club admin`
- `club portal`
- `club apex`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @app-tour/tenant-kernel exec node --test test/multi-level-host-parse.spec.ts`

**PASS:** Parser ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-171`

---
### P1-N-171 [IMPLEMENT] `P1-T-086` — export kernel index
- **EPIC:** P1-E
- **Deps:** `P1-N-170`
- **Parent deps (graph):** `T-085`

**DO THIS:**

**Files:** `packages/tenant-kernel/src/index.ts`

**Read:** `—`

**Steps:**
- Export parser

**DO NOT:** Unexported

**NEXT:** `P1-N-172`

---
### P1-N-172 [TEST] `P1-T-086` — export kernel index
- **EPIC:** P1-E
- **Deps:** `P1-N-171`
- **Parent deps (graph):** `T-085`

**Create test file:** `packages/tenant-kernel/test/multi-level-host-parse.spec.ts`

**Required assertions (write real assert for each):**
- `import from package root`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @app-tour/tenant-kernel test`

**PASS:** Exported

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-173`

---
### P1-N-173 [IMPLEMENT] `P1-T-087` — isPlatformAdminHost
- **EPIC:** P1-E
- **Deps:** `P1-N-172`
- **Parent deps (graph):** `T-085`

**DO THIS:**

**Files:** `is-platform-admin-host.ts`

**Read:** `—`

**Steps:**
- admin.root only

**DO NOT:** Club admin as platform

**NEXT:** `P1-N-174`

---
### P1-N-174 [TEST] `P1-T-087` — isPlatformAdminHost
- **EPIC:** P1-E
- **Deps:** `P1-N-173`
- **Parent deps (graph):** `T-085`

**Create test file:** `packages/tenant-kernel/test/is-platform-admin-host.spec.ts`

**Required assertions (write real assert for each):**
- `admin.root true`
- `club.admin false`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @app-tour/tenant-kernel exec node --test test/is-platform-admin-host.spec.ts`

**PASS:** Helper ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-175`

---
### P1-N-175 [IMPLEMENT] `P1-T-088` — regression host-parse
- **EPIC:** P1-E
- **Deps:** `P1-N-174`
- **Parent deps (graph):** `T-085,T-086`

**DO THIS:**

**Files:** `host-parse.spec.ts VERIFY`

**Read:** `—`

**Steps:**
- existing tests pass

**DO NOT:** Change old behavior

**NEXT:** `P1-N-176`

---
### P1-N-176 [TEST] `P1-T-088` — regression host-parse
- **EPIC:** P1-E
- **Deps:** `P1-N-175`
- **Parent deps (graph):** `T-085,T-086`

**Create test file:** `packages/tenant-kernel/test/host-parse.spec.ts`

**Required assertions (write real assert for each):**
- `acme.localhost label`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @app-tour/tenant-kernel test`

**PASS:** No regression

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-177`

---
### P1-N-177 [IMPLEMENT] `P1-T-089` — resolve-multi-level-host web
- **EPIC:** P1-E
- **Deps:** `P1-N-176`
- **Parent deps (graph):** `T-086`

**DO THIS:**

**Files:** `apps/web/src/tenant/resolve-multi-level-host.ts`

**Read:** `—`

**Steps:**
- Dev+prod wrapper

**DO NOT:** Duplicate parser

**NEXT:** `P1-N-178`

---
### P1-N-178 [TEST] `P1-T-089` — resolve-multi-level-host web
- **EPIC:** P1-E
- **Deps:** `P1-N-177`
- **Parent deps (graph):** `T-086`

**Create test file:** `apps/web/test/resolve-multi-level-host.spec.ts`

**Required assertions (write real assert for each):**
- `alborz.admin.localhost parsed`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/resolve-multi-level-host.spec.ts`

**PASS:** Resolver ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-179`

---
### P1-N-179 [IMPLEMENT] `P1-T-090` — session-host-binding update
- **EPIC:** P1-E
- **Deps:** `P1-N-178`
- **Parent deps (graph):** `T-089`

**DO THIS:**

**Files:** `session-host-binding.ts`

**Read:** `—`

**Steps:**
- multi-level admin surface

**DO NOT:** Fail-open wrong tenant

**NEXT:** `P1-N-180`

---
### P1-N-180 [TEST] `P1-T-090` — session-host-binding update
- **EPIC:** P1-E
- **Deps:** `P1-N-179`
- **Parent deps (graph):** `T-089`

**Create test file:** `apps/web/test/session-host-binding-multilevel.spec.ts`

**Required assertions (write real assert for each):**
- `admin surface bind`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/session-host-binding-multilevel.spec.ts`

**PASS:** Bind ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-181`

---
### P1-N-181 [IMPLEMENT] `P1-T-091` — dev host map extend
- **EPIC:** P1-E
- **Deps:** `P1-N-180`
- **Parent deps (graph):** `T-090`

**DO THIS:**

**Files:** `resolve-host-tenant.ts`

**Read:** `—`

**Steps:**
- multilevel localhost

**DO NOT:** Single-level only

**NEXT:** `P1-N-182`

---
### P1-N-182 [TEST] `P1-T-091` — dev host map extend
- **EPIC:** P1-E
- **Deps:** `P1-N-181`
- **Parent deps (graph):** `T-090`

**Create test file:** `apps/web/test/resolve-host-tenant-multilevel.spec.ts`

**Required assertions (write real assert for each):**
- `document or resolve`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/resolve-host-tenant-multilevel.spec.ts`

**PASS:** Dev map ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-183`

---
### P1-N-183 [IMPLEMENT] `P1-T-092` — middleware host isolation
- **EPIC:** P1-E
- **Deps:** `P1-N-182`
- **Parent deps (graph):** `T-089,T-044`

**DO THIS:**

**Files:** `middleware.ts`

**Read:** `—`

**Steps:**
- operator admin surface only

**DO NOT:** Operator on marketing

**NEXT:** `P1-N-184`

---
### P1-N-184 [TEST] `P1-T-092` — middleware host isolation
- **EPIC:** P1-E
- **Deps:** `P1-N-183`
- **Parent deps (graph):** `T-089,T-044`

**Create test file:** `apps/web/test/platform-host-isolation.spec.ts`

**Required assertions (write real assert for each):**
- `4 host matrix`
- `platform≠operator`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-host-isolation.spec.ts`

**PASS:** Isolation ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-185`

---
### P1-N-185 [IMPLEMENT] `P1-T-093` — marketing middleware
- **EPIC:** P1-E
- **Deps:** `P1-N-184`
- **Parent deps (graph):** `T-086`

**DO THIS:**

**Files:** `apps/marketing/middleware.ts`

**Read:** `—`

**Steps:**
- club apex bind

**DO NOT:** Skip marketing

**NEXT:** `P1-N-186`

---
### P1-N-186 [TEST] `P1-T-093` — marketing middleware
- **EPIC:** P1-E
- **Deps:** `P1-N-185`
- **Parent deps (graph):** `T-086`

**Create test file:** `apps/marketing/test/marketing-host-bind.spec.ts`

**Required assertions (write real assert for each):**
- `tenant subdomain`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/marketing exec node --test test/marketing-host-bind.spec.ts`

**PASS:** Marketing ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-187`

---
### P1-N-187 [IMPLEMENT] `P1-T-094` — portal middleware
- **EPIC:** P1-E
- **Deps:** `P1-N-186`
- **Parent deps (graph):** `T-086`

**DO THIS:**

**Files:** `apps/portal/middleware.ts`

**Read:** `—`

**Steps:**
- club.portal bind

**DO NOT:** Skip portal

**NEXT:** `P1-N-188`

---
### P1-N-188 [TEST] `P1-T-094` — portal middleware
- **EPIC:** P1-E
- **Deps:** `P1-N-187`
- **Parent deps (graph):** `T-086`

**Create test file:** `apps/portal/test/portal-host-bind.spec.ts`

**Required assertions (write real assert for each):**
- `portal host ok`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/portal exec node --test test/portal-host-bind.spec.ts`

**PASS:** Portal ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-189`

---
### P1-N-189 [IMPLEMENT] `P1-T-095` — API host middleware
- **EPIC:** P1-E
- **Deps:** `P1-N-188`
- **Parent deps (graph):** `T-086`

**DO THIS:**

**Files:** `apps/api/src/middleware/resolve-tenant-from-host.ts`

**Read:** `—`

**Steps:**
- Host→tenant

**DO NOT:** x-tenant-id only prod

**NEXT:** `P1-N-190`

---
### P1-N-190 [TEST] `P1-T-095` — API host middleware
- **EPIC:** P1-E
- **Deps:** `P1-N-189`
- **Parent deps (graph):** `T-086`

**Create test file:** `apps/api/test/multi-level-host-integration.spec.ts`

**Required assertions (write real assert for each):**
- `Host header sets tenant`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/multi-level-host-integration.spec.ts`

**PASS:** API ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-191`

---
### P1-N-191 [IMPLEMENT] `P1-T-096` — block platform on club admin
- **EPIC:** P1-E
- **Deps:** `P1-N-190`
- **Parent deps (graph):** `T-092`

**DO THIS:**

**Files:** `middleware.ts`

**Read:** `—`

**Steps:**
- /platform on club admin 404

**DO NOT:** Platform on tenant host

**NEXT:** `P1-N-192`

---
### P1-N-192 [TEST] `P1-T-096` — block platform on club admin
- **EPIC:** P1-E
- **Deps:** `P1-N-191`
- **Parent deps (graph):** `T-092`

**Create test file:** `apps/web/test/platform-host-isolation.spec.ts`

**Required assertions (write real assert for each):**
- `club admin /platform blocked`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-host-isolation.spec.ts`

**PASS:** Blocked ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-193`

---
### P1-N-193 [IMPLEMENT] `P1-T-097` — block operator on platform host
- **EPIC:** P1-E
- **Deps:** `P1-N-192`
- **Parent deps (graph):** `T-092`

**DO THIS:**

**Files:** `middleware.ts`

**Read:** `—`

**Steps:**
- /dashboard on admin.root redirect

**DO NOT:** Operator on platform host

**NEXT:** `P1-N-194`

---
### P1-N-194 [TEST] `P1-T-097` — block operator on platform host
- **EPIC:** P1-E
- **Deps:** `P1-N-193`
- **Parent deps (graph):** `T-092`

**Create test file:** `apps/web/test/platform-host-isolation.spec.ts`

**Required assertions (write real assert for each):**
- `platform host dashboard redirect`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-host-isolation.spec.ts`

**PASS:** Blocked ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-195`

---
### P1-N-195 [IMPLEMENT] `P1-T-098` — DEC-P1-021 comment
- **EPIC:** P1-E
- **Deps:** `P1-N-194`
- **Parent deps (graph):** `T-085`

**DO THIS:**

**Files:** `constants.ts`

**Read:** `—`

**Steps:**
- Document multi-level

**DO NOT:** Remove admin reserved

**NEXT:** `P1-N-196`

---
### P1-N-196 [TEST] `P1-T-098` — DEC-P1-021 comment
- **EPIC:** P1-E
- **Deps:** `P1-N-195`
- **Parent deps (graph):** `T-085`

**No test file.** Run verify only.

**VERIFY:** `grep DEC-P1-021 packages/tenant-kernel/src/host/constants.ts`

**PASS:** Comment ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-197`

---
### P1-N-197 [IMPLEMENT] `P1-T-099` — phase-4 contract verify
- **EPIC:** P1-E
- **Deps:** `P1-N-196`
- **Parent deps (graph):** `T-088`

**DO THIS:**

**Files:** `phase-4.contract.spec.ts`

**Read:** `—`

**Steps:**
- contract green

**DO NOT:** Break contract

**NEXT:** `P1-N-198`

---
### P1-N-198 [TEST] `P1-T-099` — phase-4 contract verify
- **EPIC:** P1-E
- **Deps:** `P1-N-197`
- **Parent deps (graph):** `T-088`

**Create test file:** `packages/tenant-kernel/test/phase-4.contract.spec.ts`

**Required assertions (write real assert for each):**
- `pass`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @app-tour/tenant-kernel test`

**PASS:** Contract ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-199`

---
### P1-N-199 [IMPLEMENT] `P1-T-100` — middleware no duplicate regex
- **EPIC:** P1-E
- **Deps:** `P1-N-198`
- **Parent deps (graph):** `T-089`

**DO THIS:**

**Files:** `platform-middleware-imports.spec.ts`

**Read:** `PATTERN-C`

**Steps:**
- import kernel not inline regex

**DO NOT:** Copy regex 3x

**NEXT:** `P1-N-200`

---
### P1-N-200 [TEST] `P1-T-100` — middleware no duplicate regex
- **EPIC:** P1-E
- **Deps:** `P1-N-199`
- **Parent deps (graph):** `T-089`

**Create test file:** `apps/web/test/platform-middleware-imports.spec.ts`

**Required assertions (write real assert for each):**
- `no duplicate TENANT_SUBDOMAIN_REGEX`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-middleware-imports.spec.ts`

**PASS:** DRY ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-201`

---
### P1-N-201 [IMPLEMENT] `P1-T-101` — EPIC E gate
- **EPIC:** P1-E
- **Deps:** `P1-N-200`
- **Parent deps (graph):** `T-092,T-095`

**DO THIS:**

**Files:** `—`

**Read:** `G-E`

**Steps:**
- Run E specs

**DO NOT:** Start F if red

**NEXT:** `P1-N-202`

---
### P1-N-202 [TEST] `P1-T-101` — EPIC E gate
- **EPIC:** P1-E
- **Deps:** `P1-N-201`
- **Parent deps (graph):** `T-092,T-095`

**No test file.** Run verify only.

**VERIFY:** `pnpm --filter @app-tour/tenant-kernel test && pnpm --filter @apps/web exec node --test test/platform-host-isolation.spec.ts`

**PASS:** G-E green

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-203`

---
### P1-N-203 [IMPLEMENT] `P1-T-102` — devHostHint in response
- **EPIC:** P1-E
- **Deps:** `P1-N-202`
- **Parent deps (graph):** `T-073`

**DO THIS:**

**Files:** `create-tenant-response.dto.ts`

**Read:** `—`

**Steps:**
- optional dev hint field

**DO NOT:** Change prod URLs

**NEXT:** `P1-N-204`

---
### P1-N-204 [TEST] `P1-T-102` — devHostHint in response
- **EPIC:** P1-E
- **Deps:** `P1-N-203`
- **Parent deps (graph):** `T-073`

**Create test file:** `apps/api/test/create-tenant-response-dto.spec.ts`

**Required assertions (write real assert for each):**
- `devHostHint for localhost`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/create-tenant-response-dto.spec.ts`

**PASS:** Hint ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-205`

---
### P1-N-205 [IMPLEMENT] `P1-T-103` — TenantDomain schema
- **EPIC:** P1-F
- **Deps:** `P1-N-204`
- **Parent deps (graph):** `T-084`

**DO THIS:**

**Files:** `schema.prisma;migration`

**Read:** `—`

**Steps:**
- model+migrate

**DO NOT:** Skip migration

**NEXT:** `P1-N-206`

---
### P1-N-206 [TEST] `P1-T-103` — TenantDomain schema
- **EPIC:** P1-F
- **Deps:** `P1-N-205`
- **Parent deps (graph):** `T-084`

**Create test file:** `apps/api/test/tenant-domain-schema.spec.ts`

**Required assertions (write real assert for each):**
- `insert domain row`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/tenant-domain-schema.spec.ts`

**PASS:** Schema ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-207`

---
### P1-N-207 [IMPLEMENT] `P1-T-104` — domain repository
- **EPIC:** P1-F
- **Deps:** `P1-N-206`
- **Parent deps (graph):** `T-103`

**DO THIS:**

**Files:** `platform-domain.repository.ts`

**Read:** `—`

**Steps:**
- CRUD

**DO NOT:** Tenant RLS

**NEXT:** `P1-N-208`

---
### P1-N-208 [TEST] `P1-T-104` — domain repository
- **EPIC:** P1-F
- **Deps:** `P1-N-207`
- **Parent deps (graph):** `T-103`

**Create test file:** `apps/api/test/platform-domain-repository.spec.ts`

**Required assertions (write real assert for each):**
- `create list`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-domain-repository.spec.ts`

**PASS:** Repo ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-209`

---
### P1-N-209 [IMPLEMENT] `P1-T-105` — domain CRUD API
- **EPIC:** P1-F
- **Deps:** `P1-N-208`
- **Parent deps (graph):** `T-104,T-005`

**DO THIS:**

**Files:** `tenants-domains.ts`

**Read:** `—`

**Steps:**
- GET POST DELETE

**DO NOT:** Auto SSL

**NEXT:** `P1-N-210`

---
### P1-N-210 [TEST] `P1-T-105` — domain CRUD API
- **EPIC:** P1-F
- **Deps:** `P1-N-209`
- **Parent deps (graph):** `T-104,T-005`

**Create test file:** `apps/api/test/platform-tenants-domains.spec.ts`

**Required assertions (write real assert for each):**
- `POST CNAME`
- `GET list`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-tenants-domains.spec.ts`

**PASS:** API ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-211`

---
### P1-N-211 [IMPLEMENT] `P1-T-106` — verify domain stub
- **EPIC:** P1-F
- **Deps:** `P1-N-210`
- **Parent deps (graph):** `T-104`

**DO THIS:**

**Files:** `verify-tenant-domain.ts`

**Read:** `—`

**Steps:**
- DNS check stub

**DO NOT:** Claim SSL done

**NEXT:** `P1-N-212`

---
### P1-N-212 [TEST] `P1-T-106` — verify domain stub
- **EPIC:** P1-F
- **Deps:** `P1-N-211`
- **Parent deps (graph):** `T-104`

**Create test file:** `apps/api/test/verify-tenant-domain.spec.ts`

**Required assertions (write real assert for each):**
- `fail wrong`
- `pass match`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/verify-tenant-domain.spec.ts`

**PASS:** Verify ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-213`

---
### P1-N-213 [IMPLEMENT] `P1-T-107` — BFF domains
- **EPIC:** P1-F
- **Deps:** `P1-N-212`
- **Parent deps (graph):** `T-105`

**DO THIS:**

**Files:** `domains/route.ts`

**Read:** `—`

**Steps:**
- GET POST

**DO NOT:** Skip BFF

**NEXT:** `P1-N-214`

---
### P1-N-214 [TEST] `P1-T-107` — BFF domains
- **EPIC:** P1-F
- **Deps:** `P1-N-213`
- **Parent deps (graph):** `T-105`

**Create test file:** `apps/web/test/platform-bff-domains.spec.ts`

**Required assertions (write real assert for each):**
- `exports GET POST`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-bff-domains.spec.ts`

**PASS:** BFF ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-215`

---
### P1-N-215 [IMPLEMENT] `P1-T-108` — tab-domains UI
- **EPIC:** P1-F
- **Deps:** `P1-N-214`
- **Parent deps (graph):** `T-107,T-070`

**DO THIS:**

**Files:** `tab-domains.tsx`

**Read:** `—`

**Steps:**
- list add CNAME verify

**DO NOT:** Empty tab

**NEXT:** `P1-N-216`

---
### P1-N-216 [TEST] `P1-T-108` — tab-domains UI
- **EPIC:** P1-F
- **Deps:** `P1-N-215`
- **Parent deps (graph):** `T-107,T-070`

**Create test file:** `apps/web/test/tab-domains.spec.ts`

**Required assertions (write real assert for each):**
- `CNAME text`
- `add form`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/tab-domains.spec.ts`

**PASS:** Tab ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-217`

---
### P1-N-217 [IMPLEMENT] `P1-T-109` — sites/check API
- **EPIC:** P1-F
- **Deps:** `P1-N-216`
- **Parent deps (graph):** `T-073`

**DO THIS:**

**Files:** `tenants-sites-check.ts`

**Read:** `—`

**Steps:**
- HEAD 3 urls

**DO NOT:** Skip endpoint

**NEXT:** `P1-N-218`

---
### P1-N-218 [TEST] `P1-T-109` — sites/check API
- **EPIC:** P1-F
- **Deps:** `P1-N-217`
- **Parent deps (graph):** `T-073`

**Create test file:** `apps/api/test/platform-sites-check.spec.ts`

**Required assertions (write real assert for each):**
- `3 results`
- `ok boolean`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-sites-check.spec.ts`

**PASS:** Health ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-219`

---
### P1-N-219 [IMPLEMENT] `P1-T-110` — health button UI
- **EPIC:** P1-F
- **Deps:** `P1-N-218`
- **Parent deps (graph):** `T-109,T-075`

**DO THIS:**

**Files:** `tab-sites MODIFY`

**Read:** `—`

**Steps:**
- check health

**DO NOT:** Fake green

**NEXT:** `P1-N-220`

---
### P1-N-220 [TEST] `P1-T-110` — health button UI
- **EPIC:** P1-F
- **Deps:** `P1-N-219`
- **Parent deps (graph):** `T-109,T-075`

**Create test file:** `apps/web/test/tab-sites-health.spec.ts`

**Required assertions (write real assert for each):**
- `fetch on click`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/tab-sites-health.spec.ts`

**PASS:** UI ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-221`

---
### P1-N-221 [IMPLEMENT] `P1-T-111` — GET audit API
- **EPIC:** P1-F
- **Deps:** `P1-N-220`
- **Parent deps (graph):** `T-028`

**DO THIS:**

**Files:** `audit-list.ts`

**Read:** `—`

**Steps:**
- paginated audit

**DO NOT:** Mix tenant audit

**NEXT:** `P1-N-222`

---
### P1-N-222 [TEST] `P1-T-111` — GET audit API
- **EPIC:** P1-F
- **Deps:** `P1-N-221`
- **Parent deps (graph):** `T-028`

**Create test file:** `apps/api/test/platform-audit-list.spec.ts`

**Required assertions (write real assert for each):**
- `TENANT_CREATED in list`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-audit-list.spec.ts`

**PASS:** Audit API

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-223`

---
### P1-N-223 [IMPLEMENT] `P1-T-112` — audit page UI
- **EPIC:** P1-F
- **Deps:** `P1-N-222`
- **Parent deps (graph):** `T-111`

**DO THIS:**

**Files:** `audit/page.tsx`

**Read:** `—`

**Steps:**
- audit table

**DO NOT:** Empty page

**NEXT:** `P1-N-224`

---
### P1-N-224 [TEST] `P1-T-112` — audit page UI
- **EPIC:** P1-F
- **Deps:** `P1-N-223`
- **Parent deps (graph):** `T-111`

**Create test file:** `apps/web/test/platform-audit-page.spec.ts`

**Required assertions (write real assert for each):**
- `imports fetch`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-audit-page.spec.ts`

**PASS:** Audit UI

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-225`

---
### P1-N-225 [IMPLEMENT] `P1-T-113` — unhealthy overview
- **EPIC:** P1-F
- **Deps:** `P1-N-224`
- **Parent deps (graph):** `T-109,T-052`

**DO THIS:**

**Files:** `platform-overview-stats MODIFY`

**Read:** `—`

**Steps:**
- unhealthyCount

**DO NOT:** Silent zero

**NEXT:** `P1-N-226`

---
### P1-N-226 [TEST] `P1-T-113` — unhealthy overview
- **EPIC:** P1-F
- **Deps:** `P1-N-225`
- **Parent deps (graph):** `T-109,T-052`

**Create test file:** `apps/web/test/platform-overview-unhealthy.spec.ts`

**Required assertions (write real assert for each):**
- `field exists number`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-overview-unhealthy.spec.ts`

**PASS:** Widget ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-227`

---
### P1-N-227 [IMPLEMENT] `P1-T-114` — audit nav
- **EPIC:** P1-F
- **Deps:** `P1-N-226`
- **Parent deps (graph):** `T-112,T-043`

**DO THIS:**

**Files:** `platform-nav MODIFY`

**Read:** `—`

**Steps:**
- audit link

**DO NOT:** Missing link

**NEXT:** `P1-N-228`

---
### P1-N-228 [TEST] `P1-T-114` — audit nav
- **EPIC:** P1-F
- **Deps:** `P1-N-227`
- **Parent deps (graph):** `T-112,T-043`

**Create test file:** `apps/web/test/platform-nav.spec.ts`

**Required assertions (write real assert for each):**
- `/platform/audit`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-nav.spec.ts`

**PASS:** Nav ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-229`

---
### P1-N-229 [IMPLEMENT] `P1-T-115` — cache on suspend
- **EPIC:** P1-F
- **Deps:** `P1-N-228`
- **Parent deps (graph):** `T-079,T-036`

**DO THIS:**

**Files:** `tenants-suspend MODIFY`

**Read:** `—`

**Steps:**
- invalidate cache

**DO NOT:** Skip cache

**NEXT:** `P1-N-230`

---
### P1-N-230 [TEST] `P1-T-115` — cache on suspend
- **EPIC:** P1-F
- **Deps:** `P1-N-229`
- **Parent deps (graph):** `T-079,T-036`

**Create test file:** `apps/api/test/platform-registry-cache.spec.ts`

**Required assertions (write real assert for each):**
- `status after suspend`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-registry-cache.spec.ts`

**PASS:** Cache ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-231`

---
### P1-N-231 [IMPLEMENT] `P1-T-116` — EPIC F gate
- **EPIC:** P1-F
- **Deps:** `P1-N-230`
- **Parent deps (graph):** `T-105,T-111`

**DO THIS:**

**Files:** `—`

**Read:** `G-F`

**Steps:**
- Run F specs

**DO NOT:** Start G if red

**NEXT:** `P1-N-232`

---
### P1-N-232 [TEST] `P1-T-116` — EPIC F gate
- **EPIC:** P1-F
- **Deps:** `P1-N-231`
- **Parent deps (graph):** `T-105,T-111`

**No test file.** Run verify only.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-tenants-domains.spec.ts test/platform-audit-list.spec.ts`

**PASS:** G-F green

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-233`

---
### P1-N-233 [IMPLEMENT] `P1-T-117` — audit actorId
- **EPIC:** P1-F
- **Deps:** `P1-N-232`
- **Parent deps (graph):** `T-032,T-028`

**DO THIS:**

**Files:** `platform-audit-actor.spec.ts`

**Read:** `—`

**Steps:**
- actor populated

**DO NOT:** Anonymous audit

**NEXT:** `P1-N-234`

---
### P1-N-234 [TEST] `P1-T-117` — audit actorId
- **EPIC:** P1-F
- **Deps:** `P1-N-233`
- **Parent deps (graph):** `T-032,T-028`

**Create test file:** `apps/api/test/platform-audit-actor.spec.ts`

**Required assertions (write real assert for each):**
- `actorId non-empty`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-audit-actor.spec.ts`

**PASS:** Actor ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-235`

---
### P1-N-235 [IMPLEMENT] `P1-T-118` — health timeout
- **EPIC:** P1-F
- **Deps:** `P1-N-234`
- **Parent deps (graph):** `T-109`

**DO THIS:**

**Files:** `tenants-sites-check MODIFY`

**Read:** `—`

**Steps:**
- 5s timeout

**DO NOT:** Hang forever

**NEXT:** `P1-N-236`

---
### P1-N-236 [TEST] `P1-T-118` — health timeout
- **EPIC:** P1-F
- **Deps:** `P1-N-235`
- **Parent deps (graph):** `T-109`

**Create test file:** `apps/api/test/platform-sites-check-timeout.spec.ts`

**Required assertions (write real assert for each):**
- `timeout ok false`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-sites-check-timeout.spec.ts`

**PASS:** Timeout ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-237`

---
### P1-N-237 [IMPLEMENT] `P1-T-119` — PlatformOpsUser schema
- **EPIC:** P1-G
- **Deps:** `P1-N-236`
- **Parent deps (graph):** `T-018`

**DO THIS:**

**Files:** `schema.prisma;migration`

**Read:** `—`

**Steps:**
- phone role unique

**DO NOT:** Plaintext password

**NEXT:** `P1-N-238`

---
### P1-N-238 [TEST] `P1-T-119` — PlatformOpsUser schema
- **EPIC:** P1-G
- **Deps:** `P1-N-237`
- **Parent deps (graph):** `T-018`

**Create test file:** `apps/api/test/platform-ops-user-schema.spec.ts`

**Required assertions (write real assert for each):**
- `insert ops user`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-ops-user-schema.spec.ts`

**PASS:** Schema ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-239`

---
### P1-N-239 [IMPLEMENT] `P1-T-120` — seed-platform-ops script
- **EPIC:** P1-G
- **Deps:** `P1-N-238`
- **Parent deps (graph):** `T-119`

**DO THIS:**

**Files:** `scripts/seed-platform-ops.ts`

**Read:** `—`

**Steps:**
- idempotent upsert

**DO NOT:** Real phones in git

**NEXT:** `P1-N-240`

---
### P1-N-240 [TEST] `P1-T-120` — seed-platform-ops script
- **EPIC:** P1-G
- **Deps:** `P1-N-239`
- **Parent deps (graph):** `T-119`

**Create test file:** `apps/api/test/seed-platform-ops.spec.ts`

**Required assertions (write real assert for each):**
- `second run no dup`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/seed-platform-ops.spec.ts`

**PASS:** Seed ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-241`

---
### P1-N-241 [IMPLEMENT] `P1-T-121` — auth DB role
- **EPIC:** P1-G
- **Deps:** `P1-N-240`
- **Parent deps (graph):** `T-119,T-005`

**DO THIS:**

**Files:** `assert-platform-ops-auth MODIFY`

**Read:** `—`

**Steps:**
- DB role override env

**DO NOT:** Env forever only

**NEXT:** `P1-N-242`

---
### P1-N-242 [TEST] `P1-T-121` — auth DB role
- **EPIC:** P1-G
- **Deps:** `P1-N-241`
- **Parent deps (graph):** `T-119,T-005`

**Create test file:** `apps/api/test/platform-auth-db-role.spec.ts`

**Required assertions (write real assert for each):**
- `support from DB`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-auth-db-role.spec.ts`

**PASS:** DB auth ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-243`

---
### P1-N-243 [IMPLEMENT] `P1-T-122` — team API
- **EPIC:** P1-G
- **Deps:** `P1-N-242`
- **Parent deps (graph):** `T-121,T-007`

**DO THIS:**

**Files:** `routes/platform/team.ts`

**Read:** `—`

**Steps:**
- GET POST owner-only POST

**DO NOT:** Support adds team

**NEXT:** `P1-N-244`

---
### P1-N-244 [TEST] `P1-T-122` — team API
- **EPIC:** P1-G
- **Deps:** `P1-N-243`
- **Parent deps (graph):** `T-121,T-007`

**Create test file:** `apps/api/test/platform-team.spec.ts`

**Required assertions (write real assert for each):**
- `list members`
- `non-owner 403`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-team.spec.ts`

**PASS:** Team API

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-245`

---
### P1-N-245 [IMPLEMENT] `P1-T-123` — team page UI
- **EPIC:** P1-G
- **Deps:** `P1-N-244`
- **Parent deps (graph):** `T-122,T-042`

**DO THIS:**

**Files:** `team/page.tsx`

**Read:** `—`

**Steps:**
- list invite

**DO NOT:** Skip page

**NEXT:** `P1-N-246`

---
### P1-N-246 [TEST] `P1-T-123` — team page UI
- **EPIC:** P1-G
- **Deps:** `P1-N-245`
- **Parent deps (graph):** `T-122,T-042`

**Create test file:** `apps/web/test/platform-team-page.spec.ts`

**Required assertions (write real assert for each):**
- `phone role fields`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/web exec node --test test/platform-team-page.spec.ts`

**PASS:** Team UI

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-247`

---
### P1-N-247 [IMPLEMENT] `P1-T-124` — RBAC on all mutators
- **EPIC:** P1-G
- **Deps:** `P1-N-246`
- **Parent deps (graph):** `T-007,T-122`

**DO THIS:**

**Files:** `routes/platform/*.ts`

**Read:** `—`

**Steps:**
- grep write guard

**DO NOT:** Unguarded POST

**NEXT:** `P1-N-248`

---
### P1-N-248 [TEST] `P1-T-124` — RBAC on all mutators
- **EPIC:** P1-G
- **Deps:** `P1-N-247`
- **Parent deps (graph):** `T-007,T-122`

**Create test file:** `apps/api/test/platform-rbac-coverage.spec.ts`

**Required assertions (write real assert for each):**
- `each POST uses guard`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-rbac-coverage.spec.ts`

**PASS:** Coverage ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-249`

---
### P1-N-249 [IMPLEMENT] `P1-T-125` — platform-rbac spec
- **EPIC:** P1-G
- **Deps:** `P1-N-248`
- **Parent deps (graph):** `T-124`

**DO THIS:**

**Files:** `platform-rbac.spec.ts`

**Read:** `—`

**Steps:**
- support 403 create

**DO NOT:** Empty spec

**NEXT:** `P1-N-250`

---
### P1-N-250 [TEST] `P1-T-125` — platform-rbac spec
- **EPIC:** P1-G
- **Deps:** `P1-N-249`
- **Parent deps (graph):** `T-124`

**Create test file:** `apps/api/test/platform-rbac.spec.ts`

**Required assertions (write real assert for each):**
- `support 403`
- `admin pass`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-rbac.spec.ts`

**PASS:** RBAC ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-251`

---
### P1-N-251 [IMPLEMENT] `P1-T-126` — EPIC G gate
- **EPIC:** P1-G
- **Deps:** `P1-N-250`
- **Parent deps (graph):** `T-125`

**DO THIS:**

**Files:** `—`

**Read:** `G-G`

**Steps:**
- Run G specs

**DO NOT:** Start H if red

**NEXT:** `P1-N-252`

---
### P1-N-252 [TEST] `P1-T-126` — EPIC G gate
- **EPIC:** P1-G
- **Deps:** `P1-N-251`
- **Parent deps (graph):** `T-125`

**No test file.** Run verify only.

**VERIFY:** `pnpm --filter @apps/api exec node --test test/platform-rbac.spec.ts test/platform-team.spec.ts`

**PASS:** G-G green

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-253`

---
### P1-N-253 [IMPLEMENT] `P1-T-127` — smoke provision script
- **EPIC:** P1-H
- **Deps:** `P1-N-252`
- **Parent deps (graph):** `T-032`

**DO THIS:**

**Files:** `scripts/smoke-platform-provision.mjs`

**Read:** `—`

**Steps:**
- POST print exit 0

**DO NOT:** No response assert

**NEXT:** `P1-N-254`

---
### P1-N-254 [TEST] `P1-T-127` — smoke provision script
- **EPIC:** P1-H
- **Deps:** `P1-N-253`
- **Parent deps (graph):** `T-032`

**No test file.** Run verify only.

**VERIFY:** `node apps/api/scripts/smoke-platform-provision.mjs --help`

**PASS:** Script ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-255`

---
### P1-N-255 [IMPLEMENT] `P1-T-128` — smoke UI script
- **EPIC:** P1-H
- **Deps:** `P1-N-254`
- **Parent deps (graph):** `T-051`

**DO THIS:**

**Files:** `scripts/smoke-platform-ui.mjs`

**Read:** `—`

**Steps:**
- check /platform

**DO NOT:** —

**NEXT:** `P1-N-256`

---
### P1-N-256 [TEST] `P1-T-128` — smoke UI script
- **EPIC:** P1-H
- **Deps:** `P1-N-255`
- **Parent deps (graph):** `T-051`

**No test file.** Run verify only.

**VERIFY:** `test -f apps/web/scripts/smoke-platform-ui.mjs`

**PASS:** Script ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-257`

---
### P1-N-257 [IMPLEMENT] `P1-T-129` — e2e create club
- **EPIC:** P1-H
- **Deps:** `P1-N-256`
- **Parent deps (graph):** `T-062,T-068`

**DO THIS:**

**Files:** `test/e2e/platform-create-club.spec.ts`

**Read:** `playwright`

**Steps:**
- 4 steps list

**DO NOT:** Empty expect

**NEXT:** `P1-N-258`

---
### P1-N-258 [TEST] `P1-T-129` — e2e create club
- **EPIC:** P1-H
- **Deps:** `P1-N-257`
- **Parent deps (graph):** `T-062,T-068`

**Create test file:** `apps/web/test/e2e/platform-create-club.spec.ts`

**Required assertions (write real assert for each):**
- `expect club in list`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `playwright test platform-create-club`

**PASS:** E2E ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-259`

---
### P1-N-259 [IMPLEMENT] `P1-T-130` — e2e owner handoff
- **EPIC:** P1-H
- **Deps:** `P1-N-258`
- **Parent deps (graph):** `T-078,T-092`

**DO THIS:**

**Files:** `test/e2e/platform-owner-handoff.spec.ts`

**Read:** `—`

**Steps:**
- invite login dashboard

**DO NOT:** Skip OTP flow

**NEXT:** `P1-N-260`

---
### P1-N-260 [TEST] `P1-T-130` — e2e owner handoff
- **EPIC:** P1-H
- **Deps:** `P1-N-259`
- **Parent deps (graph):** `T-078,T-092`

**Create test file:** `apps/web/test/e2e/platform-owner-handoff.spec.ts`

**Required assertions (write real assert for each):**
- `expect dashboard visible`

Use HTTP helper from top of doc for API tests.

**VERIFY:** `playwright test platform-owner-handoff`

**PASS:** E2E ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-261`

---
### P1-N-261 [IMPLEMENT] `P1-T-131` — exit checklist file
- **EPIC:** P1-H
- **Deps:** `P1-N-260`
- **Parent deps (graph):** `T-127,T-130`

**DO THIS:**

**Files:** `TEMP/p1-exit-checklist.md`

**Read:** `—`

**Steps:**
- copy §5 criteria

**DO NOT:** Mark done without checks

**NEXT:** `P1-N-262`

---
### P1-N-262 [TEST] `P1-T-131` — exit checklist file
- **EPIC:** P1-H
- **Deps:** `P1-N-261`
- **Parent deps (graph):** `T-127,T-130`

**No test file.** Run verify only.

**VERIFY:** `test -f TEMP/p1-exit-checklist.md`

**PASS:** Checklist ok

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1-N-263`

---
### P1-N-263 [IMPLEMENT] `P1-T-132` — update ROADMAP
- **EPIC:** P1-H
- **Deps:** `P1-N-262`
- **Parent deps (graph):** `T-131`

**DO THIS:**

**Files:** `TEMP/ROADMAP-INDEX.md`

**Read:** `—`

**Steps:**
- v4.0-ai 132 tasks

**DO NOT:** Index ok

**NEXT:** `P1-N-264`

---
### P1-N-264 [TEST] `P1-T-132` — update ROADMAP
- **EPIC:** P1-H
- **Deps:** `P1-N-263`
- **Parent deps (graph):** `T-131`

**No test file.** Run verify only.

**VERIFY:** `grep '4.0-ai\\`

**PASS:** 132 task' TEMP/ROADMAP-INDEX.md

**DO NOT:** assert.ok(true); skip file

**NEXT:** `P1 COMPLETE — see DONE WHEN`

---



---

## APPENDIX A — کد کامل برای nanoهای سخت (copy-paste)

### A1 · P1-N-004 [TEST] — platform-errors.spec.ts (کامل)

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PlatformUnauthorizedError,
  PlatformForbiddenError,
  PlatformValidationError,
} from "../src/platform/platform.errors.js";

describe("platform-errors.spec.ts", () => {
  it("P1-N-004-01 unauthorized code", () => {
    assert.equal(new PlatformUnauthorizedError().code, "PLATFORM_UNAUTHORIZED");
  });
  it("P1-N-004-02 forbidden code", () => {
    assert.equal(new PlatformForbiddenError().code, "PLATFORM_FORBIDDEN");
  });
  it("P1-N-004-03 validation code", () => {
    assert.equal(new PlatformValidationError("bad").code, "PLATFORM_VALIDATION");
  });
});
```

### A2 · P1-N-080 [TEST] — platform-provision.spec.ts (کامل)

```typescript
import assert from "node:assert/strict";
import http from "node:http";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { createRequestListener } from "../src/app";
import { createTestToursService, installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

async function platformHttpJson(
  method: "GET" | "POST",
  path: string,
  opts?: { headers?: Record<string, string>; body?: unknown },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const listener = createRequestListener({ toursService: createTestToursService() });
  return new Promise((resolve, reject) => {
    const server = http.createServer(listener);
    server.listen(0, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") { server.close(); reject(new Error("no addr")); return; }
      const payload = opts?.body === undefined ? undefined : JSON.stringify(opts.body);
      const req = http.request({
        hostname: "127.0.0.1", port: addr.port, path, method,
        headers: {
          ...(opts?.headers ?? {}),
          ...(payload ? { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(payload)) } : {}),
        },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => {
          server.close();
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode ?? 0, body: text ? JSON.parse(text) as Record<string, unknown> : {} });
        });
      });
      req.on("error", (e) => { server.close(); reject(e); });
      if (payload) req.write(payload);
      req.end();
    });
  });
}

function platformOpsHeaders(): Record<string, string> {
  return { Authorization: "Bearer test-platform-ops", "X-Platform-Ops-Phone": "+989121234567" };
}

describe("platform-provision.spec.ts", () => {
  it("P1-N-080-01 POST /platform/v1/tenants → 201", async () => {
    const subdomain = "club-" + String(Date.now());
    const { status, body } = await platformHttpJson("POST", "/platform/v1/tenants", {
      headers: { ...platformOpsHeaders(), "Idempotency-Key": randomUUID() },
      body: { subdomain, workspaceType: "denali", ownerPhone: "+989121234567" },
    });
    assert.equal(status, 201, JSON.stringify(body));
    const tenant = body.tenant as Record<string, unknown>;
    assert.equal(tenant.subdomain, subdomain);
    const sites = body.sites as Record<string, string>;
    assert.match(sites.admin, /\.admin\./);
    assert.ok(body.invite);
  });

  it("P1-N-080-02 POST without auth → 401", async () => {
    const { status } = await platformHttpJson("POST", "/platform/v1/tenants", {
      headers: { "Idempotency-Key": randomUUID() },
      body: { subdomain: "x", workspaceType: "denali", ownerPhone: "+989121234567" },
    });
    assert.equal(status, 401);
  });
});
```

### A3 · P1-N-079 [IMPLEMENT] — create-platform-tenant.schema.ts (کامل)

```typescript
import { z } from "zod";

const subdomainSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "invalid subdomain");

export const createPlatformTenantBodySchema = z
  .object({
    subdomain: subdomainSchema,
    workspaceType: z.string().min(1),
    ownerPhone: z.string().min(8),
    ownerNameNote: z.string().optional(),
    displayName: z.string().optional(),
    theme: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type CreatePlatformTenantBody = z.infer<typeof createPlatformTenantBodySchema>;

export function parseCreatePlatformTenantBody(raw: unknown): CreatePlatformTenantBody {
  const result = createPlatformTenantBodySchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`ZOD_VALIDATION_FAILED: ${result.error.message}`);
  }
  return result.data;
}
```

### A4 · buildClubSiteUrls (برای N-043)

```typescript
export type ClubSiteUrls = { marketing: string; portal: string; admin: string };

export function buildClubSiteUrls(subdomain: string, rootDomain: string): ClubSiteUrls {
  const club = subdomain.trim().toLowerCase();
  const root = rootDomain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  return {
    marketing: `https://${club}.${root}`,
    portal: `https://${club}.portal.${root}`,
    admin: `https://${club}.admin.${root}/auth/login`,
  };
}
```

### A5 · Host matrix (N-204 TEST) — platform-host-isolation.spec.ts

```typescript
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform-host-isolation.spec.ts", () => {
  it("P1-N-204-01 middleware references multi-level or platform host helper", () => {
    const s = readFileSync("apps/web/middleware.ts", "utf8");
    assert.ok(
      s.includes("resolve-multi-level-host") || s.includes("isPlatformAdminHost") || s.includes("admin."),
      "middleware must branch on platform vs club admin host",
    );
  });
  it("P1-N-204-02 tenant-kernel multi-level parser exists", () => {
    const s = readFileSync("packages/tenant-kernel/src/host/parse-multi-level-tenant-host.ts", "utf8");
    assert.match(s, /parseMultiLevelTenantHost/);
  });
});
```

### A6 · BFF tenants route skeleton (N-099 IMPLEMENT)

```typescript
// apps/web/app/api/platform/tenants/route.ts
import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE_URL ?? "http://127.0.0.1:4000";

export async function GET(req: NextRequest) {
  const res = await fetch(`${API_BASE}/platform/v1/tenants${req.nextUrl.search}`, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${API_BASE}/platform/v1/tenants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: req.headers.get("cookie") ?? "",
      "Idempotency-Key": req.headers.get("Idempotency-Key") ?? "",
    },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
```

---

## APPENDIX B — جدول سریع nano → parent

| Nano | Type | Parent |
|------|------|--------|
| N-001, N-002 | I,T | T-001 |
| N-003, N-004 | I,T | T-002 |
| ... | ... | ... |
| N-263, N-264 | I,T | T-132 |

Formula: `parent_index = ceil(nano / 2)` → T-{index:03d}


## DONE WHEN

- [ ] P1-N-080: POST /platform/v1/tenants works
- [ ] P1-N-136: create club UI
- [ ] P1-N-204: host isolation
- [ ] P1-N-264: roadmap updated
