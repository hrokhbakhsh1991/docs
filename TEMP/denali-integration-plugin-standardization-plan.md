# Denali Integration Plugin Standardization Plan (v2)

تاریخ: 2026-06-27  
وضعیت: Analysis / Plan only — بازبینی مسیر تغییر (بدون اجرای کد)  
دامنه: Integration platform، Telegram provider، Settings UI، System Consistency Guard  
هدف: هم‌تراز کردن با معماری plugin-driven، **بدون کد تکراری، لایه اشتباه، یا over-engineering**

---

## 0. خلاصه اجرایی

وضعیت عملیاتی امروز قابل استفاده است (migrations، API، `/settings/integrations`، self-service Telegram).  
ناهمترازی اصلی: رفتار Denali/Telegram هنوز در `apps/api` و `apps/web` hardcode است، نه در workspace plugin.

**قانون طلایی این پلن:** هر رفتار business/workspace فقط **یک بار** تعریف شود؛ core فقط contract اجرا کند.

| فاز | هدف | ریسک |
|-----|-----|------|
| **A** | P0: validation، dedup UI، host resolver، duplicate error، `channel.create` cleanup | کم |
| **B** | `integrationSurface` minimal در Denali plugin؛ انتقال mapping/policy/schema از core | متوسط |
| **C** | atomic secrets، migration manifest، metrics، E2E | بالا (عمداً دیرتر) |

---

## 1. شناسه‌ها و scope — قبل از هر تغییر

اشتباه قبلی (`INTEGRATION_WORKSPACE_FORBIDDEN`) از اشتباه گرفتن این دو بود:

| نام | مثال | کجا استفاده شود |
|-----|------|------------------|
| `workspaceType` | `denali` | مسیر API `/workspaces/denali/...`، ستون DB `workspace_type`، settings manifest |
| `workspaceInstanceId` | `ws-denali-dev` | claim JWT `workspace_id` — **فقط auth context** |

**قوانین ثابت (تکرار نشوند):**

1. ردیف integration همیشه با `workspace_type` scope می‌شود — نه instance id.
2. `assertWorkspaceScope` در API هر دو را می‌پذیرد: instance id دقیق **یا** `resolveWorkspaceTypeForTenant`.
3. Web همیشه `workspaceType` (مثلاً `session.workspaceType` / `pluginId`) را به proxy می‌فرستد — نه `ws-denali-dev`.
4. نام پارامتر route `:workspaceId` در API فعلاً type slug است؛ در Phase B فقط **doc/alias** اضافه شود، breaking rename نکنید.

**الگوی موجود برای scope (کپی نکنید — reuse):**

- API integrations: `assertWorkspaceScope` + `resolveWorkspaceTypeForRoute` در `integrations.service.ts`
- API settings: `resolveWorkspaceTypeForTenant` در `settings-registry.ts`
- Web branding (درست): `resolveBootstrapAppSessionForHost(host)` در `page.tsx`
- Web integrations (ناقص): فقط `readOperatorSessionFromCookies()` بدون host

---

## 2. تکرارهای فعلی و Single Source of Truth

### 2.1 جدول dedup

| موضوع | تکرار امروز | منبع حقیقت پیشنهادی | فاز |
|-------|-------------|---------------------|-----|
| Workspace scope (API) | فقط در `integrations.service.ts` (خوب) | **همان فایل** تا workspace دوم integrations نخواهد؛ بعد extract به `integration-workspace-scope.ts` | A: نگه دارید / B: extract |
| `TourCreated` + telegram mapping | `integration-event-mapping.ts` + `seedDefaultEventPolicies` + legacy DTO | Denali `integrationSurface` | B |
| Telegram `channelId`/`botToken` validation | create بدون validation؛ patch مشابه | `providers/telegram/telegram-config.validation.ts` | A |
| `hasPlatformTelegramConnection` | inline در `integrations-settings-client.tsx` | `integrations-settings-logic.ts` | A |
| `channelIdFromConfig` | inline در client | `integrations-settings-logic.ts` | A |
| Provider list در `parseProvider` | hardcoded union | `getIntegrationProvider(id)` از registry | A (کوچک) |
| Empty UX | scenario card **و** empty card همزمان برای `empty` | یک کارت: `scenario !== "empty"` برای scenario card | A |
| Plugin/workspaceType در session | `read-operator-session` بدون host vs `tenant-kernel.server` با host | **یک fix** در `read-operator-session.server.ts` | A |
| Denali required modules | `DENALI_BACKEND_REQUIRED_MODULE_IDS` hardcoded در web | generated از `denali-settings.manifest` | B |
| پیام delivery | `process-integration-delivery-once.ts` | workspace template hook | B |

### 2.2 چیزهایی که عمداً تکرار مجازند

- **Legacy dual-read** (`resolve-legacy-telegram-connection.ts`) — migration window؛ حذف نکنید تا backfill تأیید شود.
- **API `hasTelegramIntegrationConnectionRow`** vs **Web `hasPlatformTelegramConnection`** — لایه‌های مختلف (DB vs list DTO)؛ منطق مشابه ولی implementation جدا OK است. فقط **نام و شرط** را در logic/web یکسان نگه دارید.

### 2.3 لایه اشتباه — ممنوع

| نگذارید | بگذارید |
|---------|---------|
| `TourCreated` copy در `workspace-sdk` core | `packages/workspaces/denali/src/integrations/` |
| Telegram form fields در `apps/web` به‌صورت دائمی | schema از surface/API؛ Phase A فقط refactor محلی |
| `operatorSettings` modules را در web hardcode گسترش دهید | codegen / manifest binding |
| scope helper در هر proxy route | فقط service/API |
| validation Telegram در `integrations.service.ts` به‌صورت inline 50 خطی | ماژول provider |

---

## 3. وضعیت فعلی (خلاصه)

قابل دفاع: RLS، masked secrets، control plane ≠ worker، consistency guard، Denali manifest `integrations`، admin form.

ناهمتراز (جزئیات §4 قدیم): event mapping، default policy، UI hardcode، validation ناقص، secret non-atomic، delivery template در core، `channel.create` stub، host resolver، migration guard filesystem، `P2002` unmapped.

---

## 4. فاز A — P0 بدون redesign

### 4.1 هدف

سیستم فعلی **تمیز و قابل اعتماد**؛ بدون `integrationSurface` و بدون generic form renderer.

### 4.2 ترتیب وابستگی

```text
1. telegram-config.validation.ts (جدید)
2. integrations.service.ts — استفاده از validation + P2002
3. integrations.routes.ts — map خطای جدید
4. integration-event-mapping.ts — حذف channel.create
5. read-operator-session.server.ts — host-aware
6. integrations-settings-logic.ts — انتقال helpers
7. integrations-settings-client.tsx — dedup empty + import helpers
8. tests
```

### 4.3 ماتریس فایل — Phase A

| فایل | عمل | جزئیات |
|------|-----|--------|
| `apps/api/src/integrations/providers/telegram/telegram-config.validation.ts` | **ایجاد** | `parseTelegramChannelId`, `parseTelegramBotTokenForCreate`, `normalizeTelegramConfig`; خطاهای `INTEGRATION_INVALID_BODY` با code فرعی |
| `apps/api/src/integrations/http/integrations.service.ts` | **ویرایش** | create/patch/test از validation؛ `IntegrationConnectionAlreadyExistsError` روی `Prisma.P2002` unique `(tenant_id, provider, workspace_type)`؛ **extract نکنید** scope helpers به فایل دیگر در A |
| `apps/api/src/integrations/http/integrations.routes.ts` | **ویرایش** | map `409` + `INTEGRATION_CONNECTION_ALREADY_EXISTS` |
| `apps/api/src/integrations/platform/integration-event-mapping.ts` | **ویرایش** | حذف entry `channel.create` برای `TourCreated`؛ فقط `message.send` |
| `apps/api/src/integrations/providers/telegram/telegram-provider.adapter.ts` | **بدون تغییر** مگر stub حذف شود | اگر mapping حذف شد، `createChannelLink` فعلاً unused — حذف نکنید (provider contract) |
| `apps/web/src/auth/read-operator-session.server.ts` | **ویرایش** | `headers().get("host")` → `resolveBootstrapPluginIdForTenant(tenantId, host)` — **تنها** fix session؛ integrations `page.tsx` را برای pluginId دوباره bootstrap نکنید |
| `apps/web/src/integrations/integrations-settings-logic.ts` | **ویرایش** | `hasPlatformTelegramConnection`, `channelIdFromConfig`, `shouldShowIntegrationsScenarioCard(scenario)` |
| `apps/web/app/(app)/settings/integrations/integrations-settings-client.tsx` | **ویرایش** | import helpers؛ `showScenarioCard = shouldShowIntegrationsScenarioCard(scenario)`؛ حذف کارت empty وقتی scenario `empty` است **یا** برعکس — یک منبع UX |
| `apps/web/app/(app)/settings/integrations/page.tsx` | **بدون تغییر** اگر session fix کافی است | از duplicate bootstrap (branding pattern) پرهیز کنید |
| `docs/dev/workspace-integration-plugin-system.mdoc` | **به‌روز** | validation codes، scope rules، حذف `channel.create` از default mapping |

### 4.4 فایل‌های Phase A — دست نزنید

- `packages/workspace-sdk/**` (بدون doc + contract در B)
- `prisma/schema.prisma` (unique از قبل هست)
- `process-integration-delivery-once.ts` (template = Phase B)
- `prisma-integration-policy.repository.ts` (policy seed = Phase B)
- `integration-secret-store.ts` (atomic = Phase C)
- `migration-consistency-check.ts` (manifest = Phase C)
- outbox / canonical / tours

### 4.5 جزئیات پیاده‌سازی (بدون تکرار)

**Validation (create):**

- `provider === "telegram"` → `channelId` non-empty string بعد trim؛ `botToken` required on create
- `capabilities` default: `["message.send"]` — **نه** `channel.create` (هم‌راستا با mapping)
- `parseProvider`: اگر `getIntegrationProvider(id) === undefined` → invalid

**Duplicate:**

```ts
// integrations.service.ts — فقط در create
catch (e) {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new IntegrationConnectionAlreadyExistsError();
  }
  throw e;
}
```

**Empty UI dedup:**

```ts
// integrations-settings-logic.ts
export function shouldShowIntegrationsScenarioCard(
  scenario: IntegrationsWorkspaceScenario | null
): boolean {
  return scenario !== null && scenario !== "empty";
}
```

وقتی `empty` + `showCreateForm`: فقط form + یک پیام راهنما — نه scenario card + empty card.

### 4.6 تست‌های Phase A

| ID | فایل | سناریو |
|----|------|--------|
| API-INT-A1 | `integrations-verification.spec.ts` یا service spec | JWT `workspace_id=ws-denali-dev` + path `denali` → 200 |
| API-INT-A2 | `telegram-config.validation.spec.ts` (جدید) | channelId خالی، botToken خالی |
| API-INT-A3 | service spec | duplicate create → `INTEGRATION_CONNECTION_ALREADY_EXISTS` |
| API-INT-A4 | mapping spec | `TourCreated` فقط `message.send` |
| WEB-INT-A1 | `integrations-settings-logic.spec.ts` | `shouldShowIntegrationsScenarioCard("empty") === false` |
| WEB-INT-A2 | `integrations-settings-logic.spec.ts` | `hasPlatformTelegramConnection` |
| WEB-INT-A3 | `settings-integrations.spec.ts` | proxy smoke (در صورت وجود) |

**اجرای پیشنهادی:** `pnpm run test:changed` — نه full gate.

---

## 5. فاز B — plugin surface minimal

### 5.1 هدف

Denali/Telegram behavior **یک بار** در workspace package اعلام شود؛ core فقط resolve + execute.

### 5.2 طراحی `integrationSurface` (minimal v1)

فقط فیلدهای لازم — بدون generic renderer کامل در همان PR:

```ts
// packages/workspace-sdk — type only (optional on WorkspacePlugin)
type WorkspaceIntegrationSurface = {
  readonly providers: readonly {
    readonly id: IntegrationProviderId; // یا string
    readonly configFields: readonly IntegrationFieldSchema[];
    readonly credentialFields: readonly IntegrationFieldSchema[];
    readonly defaultCapabilities: readonly IntegrationCapability[];
    readonly defaultEventPolicies: readonly { eventType: string; enabled: boolean }[];
    readonly eventMappings: readonly { eventType: string; capability: IntegrationCapability }[];
  }[];
};
```

**مهم:** type در `workspace-sdk`؛ **مقادیر Denali** در `packages/workspaces/denali/src/integrations/denali-integration.surface.ts`.

### 5.3 ترتیب وابستگی Phase B

```text
1. docs: workspace-integration-plugin-system.mdoc (contract)
2. workspace-sdk: optional integrationSurface on WorkspacePlugin + validation
3. denali: denali-integration.surface.ts + wire در denali.plugin.ts
4. API: resolveIntegrationSurface(workspaceType) — یک resolver
5. seedDefaultEventPoliciesForConnection → از surface بخواند (نه if telegram)
6. integration-event-mapping.ts → merge workspace surface + platform defaults (یا deprecate static list)
7. API: GET .../integrations/meta یا embed در list — form schema برای UI
8. Web: TelegramCreateForm subcomponent — هنوز telegram-specific ولی constants از API/meta
9. process-integration-delivery-once → formatter hook از surface (یا provider delegate)
10. generate: DENALI_BACKEND_REQUIRED_MODULE_IDS از manifest
```

### 5.4 ماتریس فایل — Phase B

| فایل | عمل |
|------|-----|
| `docs/dev/workspace-integration-plugin-system.mdoc` | contract کامل surface |
| `packages/workspace-sdk/src/plugin/workspace-plugin.contract.ts` | `integrationSurface?` |
| `packages/workspace-sdk/src/plugin/workspace-plugin-validation-core.ts` | validate surface shape |
| `packages/workspaces/denali/src/integrations/denali-integration.surface.ts` | **ایجاد** — telegram، TourCreated، channelId، botToken |
| `packages/workspaces/denali/src/denali.plugin.ts` | attach surface |
| `apps/api/src/integrations/platform/resolve-integration-surface.ts` | **ایجاد** — `resolveWorkspacePlugin` → surface |
| `apps/api/src/integrations/platform/integration-event-mapping.ts` | تبدیل به merge از surface |
| `apps/api/src/integrations/infrastructure/prisma-integration-policy.repository.ts` | seed از surface |
| `apps/api/src/integrations/http/integrations.service.ts` | validation: delegate به provider adapter یا surface fields |
| `apps/api/src/integrations/worker/process-integration-delivery-once.ts` | حذف hardcoded `Tour created:` |
| `apps/web/.../integrations-settings-client.tsx` | جدا کردن `TelegramConnectionCreateForm`؛ constants از meta API |
| `scripts/generate-workspace-registry.mjs` | optional: export integration module ids برای guard |
| `apps/web/src/features/settings/settings-module-consistency-guard.ts` | consume generated list |

### 5.5 Phase B — دست نزنید / تأخیر

- Generic JSON-schema form renderer برای همه providerها — تا provider دوم واقعی نیامده
- حذف legacy table / fallback
- فعال‌سازی delivery production-wide
- Slack/WhatsApp stub providers

### 5.6 تست‌های Phase B

- Unit: `resolve-integration-surface` برای denali/starter
- Unit: seed policies از surface
- Unit: mapping merge
- API: create با schema invalid field
- Web: form labels هنوز i18n — meta فقط keys/structure

---

## 6. فاز C — production hardening

| # | کار | فایل اصلی |
|---|-----|-----------|
| C1 | connection + secret در یک `withTenantRls` tx | `integrations.service.ts`, `integration-secret-store.ts` |
| C2 | encryption envelope / KMS adapter | `integration-secret-store.ts` |
| C3 | `migration-manifest.generated.ts` at build | `scripts/generate-migration-manifest.mjs`, `migration-consistency-check.ts` |
| C4 | metrics: gate، connections، delivery backlog | `observability/metrics.ts` |
| C5 | E2E: hub → add → enable → test → duplicate | `apps/web/test` یا Playwright |

**Doc:** `docs/dev/system-consistency-guard.mdoc` برای C3.

---

## 7. Doc-first (اجباری قبل از کد core)

طبق `.cursorrules`:

| تغییر | doc |
|-------|-----|
| Phase A API validation / mapping | `docs/dev/workspace-integration-plugin-system.mdoc` |
| Phase A session host | `docs/dev/` یا بخش موجود tenant kernel اگر هست |
| Phase B surface contract | `workspace-integration-plugin-system.mdoc` + لینک از `docs/MIGRATION-MAP.md` در صورت نیاز |
| Phase C guard | `docs/dev/system-consistency-guard.mdoc` |

جمله پایانی هر PR کد:  
`Architect, documentation status: [Updated/Not Needed]. Link to docs: [...]`

---

## 8. بازبینی انتقادی (به‌روز v2)

### 8.1 Over-engineering

- Phase B را با **یک provider، یک workspace** شروع کنید.
- `integrationSurface` را بدون فیلدهای استفاده‌نشده طراحی نکنید.

### 8.2 شکستن UI

- Phase A فقط dedup کارت‌ها — form فعلی بماند.
- Phase B: `TelegramConnectionCreateForm` جدا — نه rewrite کل صفحه.

### 8.3 کد تکراری جدید

- بعد از Phase A، `parseProvider` و validation Telegram را در patch/create **shared helper** صدا بزنید — یک تابع `assertTelegramCreateBody`.
- `assertWorkspaceScope` را در web تکرار نکنید.

### 8.4 channel.create

**تصمیم Phase A:** حذف از `INTEGRATION_EVENT_MAPPINGS`؛ default capabilities فقط `message.send`.  
Stub adapter بماند تا contract provider کامل شود.

### 8.5 Delivery قبل از template

تا Phase B تمام نشده، production delivery را enable نکنید — فقط connection management + test.

---

## 9. کارهای ممنوع (همه فازها)

- Schema breaking بدون migration plan
- Provider دوم قبل از surface
- حذف legacy fallback قبل از backfill verification
- `HUSKY=0` / skip hooks
- Full gate بدون YES صریح Architect
- قرار دادن Denali copy در `apps/api/src/integrations/platform/` به‌جای denali package

---

## 10. معیار پایان (Definition of Done)

| معیار | فاز |
|-------|-----|
| host-aware session؛ duplicate error؛ validation create؛ empty UI یکپارچه؛ بدون `channel.create` mapping | A |
| `integration-event-mapping` و seed policy از Denali surface | B |
| UI form constants از API/meta نه hardcoded strings پراکنده | B |
| delivery message از template hook | B |
| atomic secret + migration manifest + E2E admin path | C |

---

## 11. پیوست — نقشه سریع مسیر فایل‌ها

```text
packages/workspaces/denali/
  src/settings/denali-settings.manifest.ts     # ماژول integrations (موجود)
  src/integrations/denali-integration.surface.ts  # Phase B — منبع حقیقت Denali

packages/workspace-sdk/
  src/plugin/workspace-plugin.contract.ts      # Phase B — type

apps/api/src/integrations/
  providers/telegram/telegram-config.validation.ts   # Phase A
  http/integrations.service.ts                       # A: validation, P2002 | B: surface delegate
  http/integrations.routes.ts                        # A: error map
  platform/integration-event-mapping.ts            # A: trim | B: merge surface
  platform/resolve-integration-surface.ts            # Phase B
  infrastructure/prisma-integration-policy.repository.ts  # B: seed
  worker/process-integration-delivery-once.ts      # B: template

apps/web/
  src/auth/read-operator-session.server.ts       # Phase A
  src/integrations/integrations-settings-logic.ts # Phase A
  app/(app)/settings/integrations/               # A: dedup | B: form split

apps/api/src/health/                             # C: migration manifest
docs/dev/workspace-integration-plugin-system.mdoc
docs/dev/system-consistency-guard.mdoc
```

---

*نسخه v2 — بازبینی مسیر تغییر برای جلوگیری از تکرار، لایه اشتباه، و refactor زودهنگام.*
