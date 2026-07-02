# Field Policy System — Execution Roadmap (Mature MVP, Revised)

> **نسخه:** 2 (پس از نقد سختگیرانه با توجه به کد واقعی Denali و platform-core)
>
> **حکم کلی:** معماری هدف درست است، اما نقشه‌ی v1 برای Denali خوش‌بینانه بود. این نسخه dual-runtime، محدودیت‌های واقعی matrix/contextual rules و anti-patternهای موجود را صریح می‌کند.

---

## نقد سختگیرانه — خلاصه حکم

| معیار | وضعیت | توضیح |
|-------|--------|--------|
| Enterprise boundary (UI vs delivery) | ✅ درست | integration layer جدا است؛ field policy نباید provider بشناسد |
| Workspace-agnostic core | ✅ درست | مدل سه‌تایی + resolver pure قابل دفاع است |
| Denali compatibility | ⚠️ ناقص در v1 | Denali از قبل rule engine سنگین‌تر از `SimpleCondition` دارد |
| Clean code / no hidden coupling | ❌ ریسک فعلی | Denali امروز `telegramIntegrationActive` در contextual rules دارد |
| Implementability | ⚠️ Phase 3/4 v1 خطرناک بود | جایگزینی wizard Denali با resolver جدید در MVP غیرواقعی است |
| Over-engineering risk | ✅ کنترل شده | اگر `SimpleCondition` برای جذب Denali گسترش یابد، شکست می‌خورد |

**نتیجه:** شروع Phase 0 + Phase 1 درست است. مهاجرت wizard Denali به field policy در MVP **غیرهدف** است.

---

## مشکلات جدی که در v1 نقشه نادیده گرفته شده بود

### 1. Denali از قبل دو موتور rule دارد (نه یکی)

```text
A) Matrix rule set  -> buildDenaliWorkspaceRuleSet() + generated denaliRuleSet
B) Contextual rules -> evaluateDenaliContextualRule() با 12+ rule kind
```

`SimpleCondition` فقط 3 operator دارد. بیشتر Denali contextual rules **قابل map مستقیم نیستند**:

- `transportOrganizedCostVisible`
- `transportDongVisible`
- `capability`
- `peakExperienceVisible`
- `telegramIntegrationActive`
- ...

**اصلاح:** Denali wizard همچنان owner موتور rule خودش می‌ماند. Field Policy فقط برای surfaceهای جدید و generic platform path است.

### 2. Coupling پنهان به integration در Denali (باید شناسایی شود، نه تکرار در platform)

در کد فعلی:

- `packages/workspaces/denali/src/field-registry/denali-contextual-rule.types.ts` → `telegramIntegrationActive`
- `denaliFieldRegistryData.ts` → `socialMediaLink` با این rule
- `denaliContextualRules.ts` → evaluate بر اساس `options.telegramIntegrationActive`

این **workspace-level gate** است، نه platform field policy. Platform نباید rule kind مثل `telegramIntegrationActive` بشناسد.

**اصلاح معماری:**

```text
Workspace UI/runtime
  -> integration status را می‌خواند
  -> fact عمومی می‌سازد: integrations.telegram.active = true|false
  -> entityState به resolver می‌دهد (فقط برای surfaceهای جدید)
  -> Denali فعلاً همان contextual engine خودش را نگه می‌دارد
```

در آینده Denali می‌تواند این gate را به `equals` روی `entityState` تبدیل کند؛ اما در platform core هیچ اشاره‌ای به Telegram نباید باشد.

### 3. `RuleEngineScope` matrix-based است، نه policy-rule-based

`packages/platform-core/src/engine/rule-resolution.ts` چند cell را با dimension matching و priority انتخاب می‌کند. این با `FieldPolicyRule` یک‌به‌یک نیست مگر:

- cell explosion (هر cell یک rule شود) — بد
- یا dimension resolution قبل از resolver — پیچیده

**اصلاح:** adapter فاز 2 فقط برای **starter / generic workspace** با rule set کوچک. Denali matrix adapter جداگانه و **post-MVP** است.

### 4. Layout ≠ Policy (باید جدا بماند)

موارد زیر **field policy نیستند**:

- `stepId` (wizard layout)
- `inactiveFieldGroups` در `WorkspaceWizardSurface`
- composite renderer ids
- `settingsSurface` / palette roadmap

این‌ها در wizard surface / workspace plugin می‌مانند. `FieldDefinition` نباید `stepId` بگیرد.

### 5. `readonly` و `tenantId` در MVP زود است

- `EffectiveFieldState` امروز فقط `hidden` + `required` دارد.
- `tenantId` در resolver تا وقتی tenant override نداریم فقط correlation/audit است؛ در logic MVP استفاده نشود.

**اصلاح:** `readonly` در type بماند (forward-compatible) اما در MVP هیچ ruleی emit نکند مگر نیاز محصولی ثابت شود.

### 6. `delivery` surface خطر ابهام دارد

درست است که delivery یک surface باشد، اما:

- integration **انتخاب field candidate** را دارد
- field policy فقط **فیلتر مجاز بودن** را دارد
- formatting/send فقط در plugin

**قرارداد صریح:**

```text
IntegrationPolicyEngine -> candidateFieldIds/tags
resolveFieldState(surface=delivery, requestedFieldIds=candidates)
Integration plugin -> format + send
```

---

## معماری نهایی — Dual Runtime

```text
┌─────────────────────────────────────────────────────────────┐
│ Platform Field Policy (جدید، minimal، pure)                  │
│  FieldDefinition + FieldPolicyRule + resolveFieldState()      │
│  Surfaces: public_website | profile | admin_panel | delivery│
│  (+ wizard فقط برای starter/generic، نه Denali wizard)      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Workspace Rules Engine (موجود، workspace-owned)             │
│  Denali: matrix + contextual rules + wizardHost hooks       │
│  Urban/starter: ruleSet + RuleEngineScope (موقت)            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Integration Layer (موجود، جدا)                              │
│  event routing | provider selection | format | send         │
└─────────────────────────────────────────────────────────────┘
```

**قانون طلایی:** platform field policy جایگزین Denali wizard rules **نمی‌شود**؛ کنار آن قرار می‌گیرد.

---

## مدل نهایی MVP (بدون تغییر مفهومی، با محدودیت‌های اجرایی)

### FieldDefinition (identity only)

```ts
export type FieldDefinition = {
  id: string;
  workspaceType: string;
  canonicalPath: string;
  kind: "text" | "number" | "date" | "enum" | "boolean" | "composite";
  labelKey?: string;
  descriptionKey?: string;
  tags?: string[];
  validation?: Record<string, unknown>;
  version: number;
};
```

**خارج از scope:** `stepId`, `rhfPath`, `zodPath`, `wire`, provider refs

### FieldPolicyRule (UI + selection policy only)

```ts
export type FieldPolicyRule = {
  id: string;
  workspaceType: string;
  fieldId: string;
  surface: "wizard" | "public_website" | "profile" | "admin_panel" | "delivery";
  state: "hidden" | "visible" | "required" | "readonly";
  condition?: SimpleCondition;
  priority: number;
  enabled: boolean;
};
```

### SimpleCondition (strict — بدون گسترش برای Denali)

```ts
export type SimpleCondition =
  | { kind: "always" }
  | { kind: "equals"; path: string; value: string | number | boolean | null }
  | { kind: "exists"; path: string };
```

**ممنوع:** گسترش DSL برای جذب `transportDongVisible` و مشابه. آن‌ها workspace engine می‌مانند.

### resolveFieldState (pure)

```ts
export type ResolveFieldStateInput = {
  tenantId: string; // MVP: passthrough only, no tenant rule lookup
  workspaceType: string;
  surface: "wizard" | "public_website" | "profile" | "admin_panel" | "delivery";
  requestedFieldIds?: string[];
  entityState: Record<string, unknown>;
  definitions: readonly FieldDefinition[];
  rules: readonly FieldPolicyRule[];
};

export type ResolvedFieldState = {
  fieldId: string;
  canonicalPath: string;
  state: "hidden" | "visible" | "required" | "readonly";
  reasonRuleId?: string;
};
```

**تغییر مهم نسبت به v1:** definitions و rules به‌صورت explicit input به resolver داده می‌شوند (pure). load از plugin/DB بیرون resolver است.

**Internal pipeline (ثابت):**

```text
1. filter definitions (workspaceType + requestedFieldIds)
2. filter rules (workspaceType + surface + enabled)
3. evaluate condition per rule
4. pick winning rule per field (priority, then state precedence)
5. default hidden if no match
```

State precedence: `required > readonly > visible > hidden`

---

## Non-Goals صریح (MVP)

- جایگزینی `evaluateDenaliContextualRule`
- مهاجرت Denali matrix به `FieldPolicyRule`
- حذف `RuleEngineScope` برای Denali
- persisted `FieldEventTrigger` / `FieldDeliveryTarget` / `FieldTimingRule`
- provider/template/formatting در field policy
- tenant-editable policy UI
- گسترش `SimpleCondition` برای rule kindهای Denali

---

## فازبندی اجرایی (اصلاح‌شده)

### Phase 0 — Architecture Doc Lock

**هدف:** doc رسمی در `docs/` قبل از تغییر `platform-core`.

**فایل پیشنهادی:** `docs/architecture/field-policy-system.md`

**باید شامل باشد:**

- dual-runtime diagram
- Denali non-goals
- integration boundary contract
- forbidden concepts
- `telegramIntegrationActive` به‌عنوان workspace anti-pattern مثال (نه platform pattern)

**DoD:** doc merged؛ هنوز بدون کد production.

---

### Phase 1 — Pure Field Policy Core

**مسیر:**

```text
packages/platform-core/src/field-policy/
  types.ts
  evaluate-simple-condition.ts
  resolve-field-state.ts
  index.ts
packages/platform-core/test/unit/field-policy/
  resolve-field-state.spec.ts
  evaluate-simple-condition.spec.ts
```

**محدودیت‌ها:**

- zero import از `apps/api`, `integrations`, `workspace-denali`
- resolver pure با definitions/rules به‌عنوان input
- `tenantId` در logic استفاده نشود

**DoD:**

- unit tests برای always/equals/exists/priority/default-hidden
- forbidden-term grep روی path بالا

**Verification:**

```bash
pnpm --filter @app-tour/platform-core test -- field-policy
```

---

### Phase 2 — Starter Adapter Only (نه Denali)

**هدف:** bridge از `WorkspaceRuleSet` فقط برای workspaceهای generic (starter).

**مسیر:**

```text
packages/platform-core/src/field-policy/adapters/
  workspace-rule-set-to-policy.ts
```

**Mapping محدود:**

```text
WorkspaceFieldRegistryEntry -> FieldDefinition (workspaceType از plugin)
field.required default -> rule(state=required, surface=wizard, condition=always)
cell override hidden -> rule(state=hidden)
cell override required -> rule(state=required)
```

**محدودیت صریح:**

- matrix dimensions به `entityState` map می‌شوند **قبل** از resolver (در adapter caller)
- اگر dimension resolution پیچیده بود، caller همان `RuleEngineScope` قدیمی را نگه می‌دارد
- **Denali در این فاز لمس نشود**

**DoD:** parity test با starter fixture؛ Denali tests بدون تغییر سبز.

---

### Phase 3 — New Surfaces First (نه wizard migration)

**هدف:** استفاده از field policy برای surfaceهایی که امروز engine ندارند:

- `public_website`
- `profile`
- `admin_panel`
- `delivery` (فقط eligibility filter)

**نه هدف این فاز:** تغییر `buildRenderPlan()` برای Denali.

**الگوی مصرف:**

```ts
const states = resolveFieldState({
  tenantId,
  workspaceType,
  surface: "public_website",
  entityState: buildEntityStateFromTour(tour),
  definitions: pluginExportedDefinitions,
  rules: pluginExportedRules,
});
```

**DoD:** API/read path برای surface جدید؛ wizard Denali بدون تغییر رفتار.

---

### Phase 4 — Denali Coexistence (نه Rewrite)

**هدف:** Denali فقط exporter metadata برای platform surfaces؛ wizard engine خودش بماند.

**کارهای مجاز:**

- mapper: `DenaliFieldDefinition` → `FieldDefinition` (بدون rhf/zod/wire)
- export tags برای `delivery` / `public_website` selection
- document کردن codegen pipeline: `pnpm --filter web generate:denali-wizard`

**کارهای ممنوع:**

- حذف `evaluateDenaliContextualVisibility`
- تبدیل 12+ contextual kind به platform DSL
- تغییر `buildDenaliWorkspaceRuleSet()` behavior
- import `workspace-denali` در `platform-core`

**مسیرهای Denali (reference):**

```text
packages/workspaces/denali/src/field-registry/denaliFieldRegistryData.ts
packages/workspaces/denali/src/denali-plugin-adapter.ts
packages/workspaces/denali/src/rules/denaliContextualRules.ts
packages/workspaces/denali/src/rules/denaliUIAdapter.ts
```

**DoD:** export mapper + tests؛ تمام denali wizard visibility tests سبز؛ هیچ رگرسیون wizard.

---

### Phase 5 — Integration Boundary Hardening

**هدف:** تضمین جدایی integration از field policy.

**کارها:**

- static guard: no provider strings in `field-policy/`
- contract test برای import boundary
- document flow:

```text
DomainEvent
  -> IntegrationPolicyEngine
  -> candidate fields (integration config)
  -> resolveFieldState(surface=delivery)
  -> provider plugin format + send
```

**مسیرهای integration (دست نزن مگر لازم):**

```text
apps/api/src/integrations/application/integration-policy-engine.ts
apps/api/src/integrations/application/dispatch-integration-domain-event.ts
apps/api/src/integrations/platform/format-integration-delivery-message.ts
apps/api/src/integrations/providers/telegram/*
```

**DoD:** guards سبز؛ field policy بدون provider awareness.

---

### Phase 6 — Optional Persistence (فقط با نیاز محصولی)

**شرط شروع:** tenant-editable policies یا admin UI واقعی.

**جداول مجاز:** `field_definitions`, `field_policy_rules`

**جداول ممنوع:** triggers, delivery targets, timing rules

---

## وضعیت فعلی کد — مرجع سریع

### نگه دار / مالکیت درست

| مسیر | نقش |
|------|-----|
| `packages/workspace-sdk/src/registry/field-registry.ts` | پایه identity |
| `packages/workspace-sdk/src/registry/rule-set.ts` | matrix موقت برای generic wizard |
| `packages/platform-core/src/engine/rule-engine.scope.ts` | resolver فعلی generic wizard |
| `apps/api/src/integrations/*` | delivery owner |

### Denali — workspace-owned (دست نزن در MVP wizard path)

| مسیر | نقش |
|------|-----|
| `denali-plugin-adapter.ts` | map به WorkspaceFieldRegistry + RuleSet |
| `denaliContextualRules.ts` | contextual engine (12+ kinds) |
| `denali-contextual-rule.types.ts` | شامل `telegramIntegrationActive` |
| generated `denaliRuleSet.generated.ts` | matrix codegen output |

---

## Forbidden Checks (هر PR)

```text
No telegram/email/sms/slack/whatsapp in platform-core/src/field-policy
No template/formatter/schedule/cron in field-policy
No FieldEventTrigger / FieldDeliveryTarget / FieldTimingRule
No all/any/not/script conditions
No import from workspace-denali in platform-core
No Denali contextual rule kinds in platform-core
```

---

## Definition of Done — کل پروژه MVP

- [ ] `resolveFieldState()` pure, deterministic, tested
- [ ] dual-runtime documented و رعایت شده
- [ ] Denali wizard behavior unchanged
- [ ] new surfaces می‌توانند از field policy استفاده کنند
- [ ] integration تنها مسیر outbound
- [ ] `telegramIntegrationActive` در platform تکرار نشده
- [ ] `SimpleCondition` گسترش نیافته برای Denali

---

## Verification Strategy

Fast-track (پیش‌فرض):

```bash
pnpm run pre-commit:fast
pnpm run guard:import-boundary
```

Per-phase:

```text
Phase 1: platform-core field-policy unit tests
Phase 2: starter adapter parity only
Phase 3: new surface resolver tests
Phase 4: Denali export mapper tests + existing denali visibility suite
Phase 5: forbidden-term + import-boundary guard
```

Heavy gates (`phase-5:gate`, `ci:integrity`, `test:full`) فقط با تایید صریح.

---

## ترتیب امن اجرا (نسخه اصلاح‌شده)

```text
Phase 0: docs/architecture/field-policy-system.md
Phase 1: pure field-policy core + tests
Phase 2: starter-only WorkspaceRuleSet adapter
Phase 3: new surfaces (public/profile/admin/delivery eligibility)
Phase 4: Denali metadata export + coexistence (no wizard rewrite)
Phase 5: integration boundary guards
Phase 6: persistence only if product requires
```

---

## جمع‌بندی نقد

معماری هدف **enterprise-safe** است اگر dual-runtime را بپذیریم. خطای v1 این بود که Denali را مثل starter فرض کردیم. Denali یک workspace consumer است با rule engine بالغ — field policy باید لایه‌ی جدید برای surfaceهای عمومی و delivery eligibility باشد، نه جایگزین wizard.

اگر یک اصل را انتخاب کنیم:

> **Platform policy را کوچک نگه دار؛ workspace rules را حذف نکن؛ integration را جدا نگه دار.**

---

## Gap Register (Closure Plan — 2026-06-27)

### P0 — باید قبل از workspace جدید بسته شود

| ID | نقص | اقدام planned | وضعیت |
|----|-----|-------------|--------|
| P0-1 | `WorkspacePlugin` فاقد `fieldPolicy` رسمی | اضافه کردن `WorkspaceFieldPolicyManifest` اختیاری در workspace-sdk | done |
| P0-2 | هیچ consumer production برای `resolveFieldState` | اضافه کردن `filterDeliveryEligibleFields()` pure helper | done |
| P0-3 | `entityState` بدون قرارداد استاندارد | اضافه کردن `FieldPolicyEntityState` + path constants | done |
| P0-4 | dual-runtime بدون migration guide | به‌روزرسانی `docs/architecture/field-policy-system.md` | done |
| P0-5 | تغییرات commit نشده | commit پس از verification | pending |

### P1 — enterprise completeness

| ID | نقص | اقدام | وضعیت |
|----|-----|-------|--------|
| P1-1 | `tenantId` در resolver استفاده نمی‌شود | reserved — documented only in MVP | open |
| P1-2 | `readonly` state unused in practice | keep type, no rules yet | open |
| P1-3 | default hidden ممکن است برای public_website سخت باشد | workspace rules must opt-in explicitly | by_design |
| P1-4 | priority semantics | documented in architecture doc | done |
| P1-5 | tags overloaded | use deliveryCandidateFieldIds in manifest | done |
| P1-6 | adapter multi-dimension unsupported | documented; complex workspaces keep own engine | by_design |
| P1-7 | Denali mapper duplicate | local mapper retained for dist boundary | by_design |
| P1-8 | guard فقط platform-core field-policy | root `guard:field-policy-boundary` added | done |
| P1-9 | integration delivery contract missing | delivery filter helper + starter reference | done |
| P1-10 | persistence/audit/versioning | deferred post-MVP | deferred |

### P2 — acceptable deferrals

| ID | نقص | وضعیت |
|----|-----|--------|
| P2-1 | validation as Record<string, unknown> | deferred |
| P2-2 | observability beyond reasonRuleId | deferred |
| P2-3 | integration E2E with real outbox | deferred |
| P2-4 | Urban workspace not wired | deferred |
| P2-5 | scheduled/event visibility | deferred — use domain events externally |

### Closure execution order (this sprint)

```text
1. Gap register (this section)
2. workspace-sdk WorkspaceFieldPolicyManifest + optional plugin field
3. platform-core FieldPolicyEntityState + filterDeliveryEligibleFields
4. starter reference manifest + delivery rules
5. docs + guards + targeted tests
```

### Migration guide (workspace consumer)

```text
Simple matrix (0-1 dimension) → adaptWorkspaceRuleSetToFieldPolicy + resolveFieldState
New surfaces (public/profile/admin/delivery) → WorkspaceFieldPolicyManifest.fieldPolicy
Complex contextual rules (Denali-like) → keep workspace engine; export metadata only
Delivery outbound → integration picks candidates → filterDeliveryEligibleFields → provider plugin
Never → put Telegram/provider logic in field-policy core
```
