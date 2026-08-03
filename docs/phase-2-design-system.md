# Phase 2 — Design System & Enterprise Visual Layer

> **AI-execution (agents):** [`phase-2-design-system.ai-exec.md`](phase-2-design-system.ai-exec.md) · [`phase-2/phase-2.ai-exec.index.md`](phase-2/phase-2.ai-exec.index.md) · hub [`phase-2/README.md`](phase-2/README.md)  
> **Gate (repo):** `pnpm run phase-2:gate` (check-node-engine + build + test + test:phase-2 + guards + 16× `p2_*`) · `ci:integrity` = phase-0 + phase-1 + phase-2 gates  
> **Canonical (Markdoc):** [`phase-2-design-system.mdoc`](phase-2-design-system.mdoc) · §19 · `pnpm run guard:doc-sync`  
> **Forensic (permanent):** [`audits/phase-2-zero-debt-forensic-audit-2026-06-02.mdoc`](audits/phase-2-zero-debt-forensic-audit-2026-06-02.mdoc) · [`audits/phase-2-zero-debt-forensic-audit-2026-06-02.md`](audits/phase-2-zero-debt-forensic-audit-2026-06-02.md)  
> **Integrity:** [`audits/phase-2-documentation-integrity-2026-06-03.mdoc`](audits/phase-2-documentation-integrity-2026-06-03.mdoc)

**app-tour — راهنمای اجرایی کامل فاز دو**

> **نقش:** بسط عمیق فاز ۲ در [`MIGRATION-MAP.md`](MIGRATION-MAP.md) §۱۱  
> **پیش‌نیاز:** [`phase-1/phase-1.ai-exec.index.md`](phase-1/phase-1.ai-exec.index.md) — `pnpm run phase-1:gate` سبز (**≥148** / closure **≥56** · `gate-thresholds.mjs`) · body below may lag `.mdoc`  
> **North Star:** Platform semantics = generic tokens · Workspace brand = injectable theme · Tenant = visual boundary hook (فاز ۴)  
> **مرجع legacy (port انتخابی):** [`legacy/packages/ui/`](../legacy/packages/ui/) · [`legacy/libs/core/src/types/tenant-config.ts`](../legacy/libs/core/src/types/tenant-config.ts)

---

## فهرست

1. [چرا فاز ۲ قبل از apps و Denali](#1-چرا-فاز-۲-قبل-از-apps-و-denali)
2. [استانداردهای enterprise (مرجع صنعت ۲۰۲۵–۲۰۲۶)](#2-استانداردهای-enterprise-مرجع-صنعت-۲۰۲۵۲۰۲۶)
3. [درس‌های legacy — چه port کنیم / چه نه](#3-درس‌های-legacy--چه-port-کنیم--چه-نه)
4. [تعریف دقیق خروجی فاز ۲](#4-تعریف-دقیق-خروجی-فاز-۲)
5. [معماری چندلایه theme (tenant × workspace × platform)](#5-معماری-چندلایه-theme-tenant--workspace--platform)
6. [DAG و زیرفازها](#6-dag-و-زیرفازها)
7. [زیرفاز 2.1 — `packages/design-tokens`](#7-زیرفاز-21--packagesdesign-tokens)
8. [زیرفاز 2.2 — `WorkspaceThemeContract` در SDK](#8-زیرفاز-22--workspacethemecontract-در-sdk)
   - [8.2.1 Theme Ingress Security (زیرفاز 2.2.1)](#821-theme-ingress-security-زیرفاز-221)
9. [زیرفاز 2.3 — `packages/ui-primitives`](#9-زیرفاز-23--packagesui-primitives)
10. [زیرفاز 2.4 — ThemeProvider chain (harness)](#10-زیرفاز-24--themeprovider-chain-harness)
11. [زیرفاز 2.5 — Visual QA + `phase-2-guard`](#11-زیرفاز-25--visual-qa--phase-2-guard)
12. [آنچه در فاز ۲ ممنوع است](#12-آنچه-در-فاز-۲-ممنوع-است)
13. [Definition of Done فاز ۲](#13-definition-of-done-فاز-۲)
14. [چک‌لیست ورود به فاز ۳](#14-چک‌لیست-ورود-به-فاز-۳)
15. [Phase 3: Infrastructure & Access Control](#15-phase-3-infrastructure--access-control)
16. [پل به MIGRATION-MAP §5–§10](#16-پل-به-migration-map-۵۱۰)
17. [پیوست‌ها](#17-پیوست‌ها)

---

## 1. چرا فاز ۲ قبل از apps و Denali

### 1.1 ترتیب صحیح پلتفرم

```text
Phase 0  contract (workspace-sdk)
    ↓
Phase 1  engine headless (platform-core) — RenderPlan بدون رنگ
    ↓
Phase 2  visual enterprise layer (این سند) — tokens + primitives + theme contract
    ↓
Phase 3  starter workspace + apps/web shell — wizard واقعی + CASL (`ability.ts`)
    ↓
Phase 4  tenant-kernel (RLS, subdomain) — TenantThemeProvider واقعی
    ↓
Phase 6  Denali plugin — widgets + theme/tokens.css در workspace
```

**قانون محصول:** Denali = اولین **workspace محصول**، نه اولین **لایهٔ visual**. اگر ویزارد قبل از tokens ساخته شود، دوباره به الگوی legacy می‌رویم: `DenaliFieldRenderer`، رنگ hardcode، و coupling در shell.

### 1.2 شکست visual در legacy

| مشکل legacy | پیامد | قانون فاز ۲ |
|-------------|--------|-------------|
| `@tour/ui` + feature CSS پر از `var(--color-*)` بدون تفکیک platform/workspace | rebrand = hunt گسترده | سه سطح token ([§5](#5-معماری-چندلایه-theme-tenant--workspace--platform)) |
| ویجت Denali داخل feature tree | shell نمی‌تواند generic باشد | composite فقط در `packages/workspaces/*` فاز ۶ |
| tenant theme + workspace theme در یک لایه | override نامشخص | قرارداد جدا: `TenantThemeConfig` (فاز ۴) vs `WorkspaceThemeContract` (فاز ۲) |
| بدون `WorkspacePlugin.theme` در contract جدید | engine/UI جدا از brand | `theme` اختیاری روی plugin در SDK |

### 1.3 خروجی فاز ۲ در یک جمله

> **هر کامپوننت generic و هر workspace plugin می‌تواند ظاهر enterprise داشته باشد، بدون import Denali و بدون رنگ در `platform-core` — فقط semantic CSS variables و قرارداد theme.**

---

## 2. استانداردهای enterprise (مرجع صنعت ۲۰۲۵–۲۰۲۶)

این بخش **الزام طراحی** فاز ۲ است — نه لیست ابزار اختیاری.

### 2.1 الگوی معماری: Microkernel + contribution points

| اصل | منبع صنعت | پیاده‌سازی app-tour |
|-----|-----------|---------------------|
| هسته پایدار، قابلیت‌ها قابل تعویض | VS Code / Shopify embedded apps | `platform-core` + `WorkspacePlugin` |
| plugin مستقیم به plugin وصل نشود | Event bus / host SDK | lifecycle/events در فاز ۴–۵؛ UI از host props |
| قرارداد manifest قبل از loader | Widget registries | `WorkspacePlugin` + `contractVersion` ([MAP §8](MIGRATION-MAP.md#۸-plugin-lifecycle--versioning)) |

### 2.2 Multi-tenant visual isolation

| سناریو | راهکار استاندارد | فاز |
|--------|------------------|-----|
| SaaS pool (اکثریت tenantها) | shared UI bundle + **per-tenant CSS variables** روی subtree | ۴ (`TenantThemeProvider`) |
| Workspace brand متفاوت | plugin `theme.cssVariables` + optional stylesheet | ۲–۳ |
| Enterprise silo (compliance) | dedicated DB/schema — **نه** fork UI | ۷ ([MAP §7.2](MIGRATION-MAP.md#۷۲-hybrid-tier-فاز-۷--enterprise-contract)) |
| Tenant A نباید stylesheet Tenant B را ببیند | scope CSS به `[data-tenant-id]` یا subtree provider | ۴ |

**قانون:** `tenantId` در فاز ۲ فقط در **harness/test** شبیه‌سازی می‌شود؛ enforcement production در فاز ۴.

### 2.3 بارگذاری UI workspace (trust model)

| Trust | Loader | فاز app-tour |
|-------|--------|--------------|
| First-party monorepo | `import()` compile-time / dynamic از allowlist | ۳–۶ |
| Marketplace third-party | iframe + postMessage **یا** signed manifest + sandbox | **بعد از** DoD پلتفرم ([MAP §9](MIGRATION-MAP.md#۹-مدل-اعتماد-plugin--first-party-vs-third-party)) |

فاز ۲ **فقط** first-party: `@app-tour/design-tokens`, `@app-tour/ui-primitives` — بدون runtime npm plugin.

### 2.4 Design tokens (W3C / industry practice)

- **Primitives:** spacing, radius, font-size, raw palette scales — نام ثابت، مقدار عوضشونده.
- **Semantics:** `--color-surface`, `--color-text-primary` — کامپوننت‌ها **فقط** semantic می‌خوانند.
- **Workspace brand:** `--ws-color-accent`, `--ws-font-display` — prefix `--ws-` تا با platform قاطی نشود.
- **Dark mode:** class روی `html` (`theme-light` / `theme-dark`) — الگوی legacy [`legacy/packages/ui/src/tokens/`](../legacy/packages/ui/src/tokens/).

### 2.5 دسترسی‌پذیری و i18n (enterprise minimum)

| موضوع | الزام فاز ۲ |
|-------|-------------|
| Focus ring | semantic `--color-focus-ring` |
| Contrast | document در playground؛ AA برای text/primary در light **و** dark |
| RTL | primitives با logical properties (`margin-inline`)؛ فونت فارسی در **فاز ۳** (`next/font`) |
| Motion | respect `prefers-reduced-motion` در token/harness |

### 2.6 Performance budget (ثبت baseline)

| معیار | هدف فاز ۲ (ثبت در gate) | یادداشت |
|-------|---------------------------|---------|
| CSS tokens bundle (gzip) | ≤ 15 KB | فقط CSS، بدون فونت |
| ui-primitives tree-shake | هر primitive قابل import جدا | `package.json` exports |
| First paint harness | بدون شبکه — Storybook/playground static | فاز ۲ بدون DB |

---

## 3. درس‌های legacy — چه port کنیم / چه نه

### 3.1 جدول port

| دارایی legacy | مسیر | فاز ۲ | مقصد app-tour |
|---------------|------|-------|----------------|
| Token CSS light/dark | `legacy/packages/ui/src/tokens/*.css` | ✅ port | `packages/design-tokens` |
| validate-design-tokens | `legacy/scripts/validate-design-tokens.js` | ✅ بازنویسی | `scripts/guards/validate-design-tokens.mjs` + **`tokens.meta.json`** (بدون `docs/10-product/`) |
| Button, Input, FormField, Alert, Badge, Card | `legacy/packages/ui/src/components/*` | ✅ subset | `packages/ui-primitives` |
| `TenantThemeConfig` shape | `legacy/libs/core/.../tenant-config.ts` | ✅ types only | الهام `WorkspaceThemeContract` + فاز ۴ tenant |
| `build-tenant-theme-style` | `legacy/apps/web/lib/tenant/` | ⏸ الگوریتم | فاز ۴ `TenantThemeProvider` |
| `ThemeProvider` / `ThemeInjector` | `legacy/apps/web/lib/theme`, `lib/tenant` | ⏸ | فاز ۳–۴ apps/web |
| `AppLayout`, `WorkspaceShell` | `legacy/apps/web`, `@tour/ui/layout` | ⏸ | فاز ۳ shell |
| JalaliDatePicker | `@tour/ui` | ⏸ | فاز ۶ Denali یا ۳ اگر starter نیاز داشت |
| Tailwind | — | ❌ نداریم | CSS Modules + vars (همان legacy) |
| Tour catalog themes | `settings/tour-themes` | ❌ | domain data — فاز ۶ |

### 3.2 anti-pattern های visual (checklist منفی)

| ID | Anti-pattern | تشخیص | اقدام |
|----|--------------|--------|--------|
| V1 | `--denali-*` یا `denali-green` در packages جدید | `rg -i denali packages/design-tokens packages/ui-primitives` | revert |
| V2 | import `@tour/ui` از app-tour جدید | depcruise | ممنوع |
| V3 | رنگ hex در `platform-core` | `rg "#[0-9a-fA-F]{3,8}" packages/platform-core` | revert |
| V4 | primitive بدون semantic token | code review | فقط `var(--color-*)` |
| V5 | static import `workspaces/denali` در ui-primitives | depcruise | revert |
| V6 | `WorkspacePlugin` بدون validation برای `theme` | SDK test | `assertWorkspacePlugin` extended |
| V7 | شکستن contrast در dark حذف token | visual QA | block merge |

---

## 4. تعریف دقیق خروجی فاز ۲

### 4.1 خروجی‌های hard

> **هم‌ترازی سند:** معیار ادغام = [§13](#13-definition-of-done-فاز-۲). خروجی‌های زیرفاز §7–§11 را با وضعیت واقعی هم‌خوان نگه دارید؛ موارد backlog در [§13.1](#131-ممیزی-فاز-۲--backlog-نه-complete--نه-شکست-gate).

- [x] `packages/design-tokens` — build + export CSS (+ optional TS token map)
- [x] `packages/ui-primitives` — Button, Input, FieldShell, **Alert** (حداقل §9.2)
- [ ] **Backlog** — **Select**, **Checkbox** (P1 §9.2) — **فاز ۳** ([§13.1](#131-ممیزی-فاز-۲--backlog-نه-complete--نه-شکست-gate))؛ **Badge** / **P2-005** hygiene در `src/**/*.module.css` — **Remediated** (تست `component-token-maps-wiring.spec.ts`)
- [x] `WorkspaceThemeContract` + فیلد اختیاری `theme` روی `WorkspacePlugin`
- [x] `assertWorkspacePlugin` — اعتبارسنجی `theme` وقتی موجود است
- [x] `packages/theme-react` **یا** `apps/web-harness/` — زنجیره سه‌سطحی provider (minimal) — **مسیر A (`theme-react`)**
- [x] `phase-2-guard` — token drift + depcruise rules جدید + حداقل N unit test
- [x] `dependency-cruiser` — قوانین design-tokens / ui-primitives
- [x] **بدون** `apps/api`، **بدون** Postgres، **بدون** Denali package

### 4.2 خروجی‌های soft

- [x] Storybook **یا** `ui-playground` static page — sanity بصری (Storybook در `ui-primitives`)
- [ ] جدول mapping `RenderFieldPlan.kind` → primitive (سند در این فایل §16) — **باقی‌مانده process**
- [x] `reports/phase-2-gate-*.json` (آخرین: `reports/phase-2-gate-YYYY-MM-DD.json` پس از `pnpm run phase-2:gate`)

### 4.3 Definition of Done (یک جمله)

> **Starter می‌تواند در فاز ۳ با semantic tokens و primitives بدون هیچ رنگ workspace-specific در core رندر شود؛ workspace theme فقط از plugin inject می‌شود.**

---

## 5. معماری چندلایه theme (tenant × workspace × platform)

### 5.1 سه سطح token (ثابت)

```text
┌─────────────────────────────────────────────────────────────┐
│  Level 1 — Platform (design-tokens)                          │
│  --spacing-*, --font-size-*, --color-surface, --color-text-* │
└───────────────────────────────┬─────────────────────────────┘
                                │ cascade
┌───────────────────────────────▼─────────────────────────────┐
│  Level 2 — Tenant (فاز ۴ — types در فاز ۲ ثبت می‌شود)        │
│  logo, accent override, --color-primary* از TenantThemeConfig │
└───────────────────────────────┬─────────────────────────────┘
                                │ cascade
┌───────────────────────────────▼─────────────────────────────┐
│  Level 3 — Workspace plugin (WorkspaceThemeContract)         │
│  --ws-color-accent, --ws-font-display, optional stylesheet   │
└───────────────────────────────┬─────────────────────────────┘
                                │
                    WizardShell / ui-primitives
```

### 5.2 زنجیره Provider (هدف — فاز ۲ harness، فاز ۳ production)

```text
PlatformThemeProvider          ← import @app-tour/design-tokens/styles.css
  └ TenantThemeProvider        ← props از tenant-kernel (mock در فاز ۲)
       └ WorkspaceThemeProvider  ← از WorkspacePlugin.theme
            └ FieldShell / wizard slot
```

**فاز ۲:** `TenantThemeProvider` با props ثابت test؛ بدون BFF.

### 5.3 قرارداد `WorkspaceThemeContract` (شکل هدف)

```typescript
/** workspace-sdk — فاز 2.2 */
export interface WorkspaceThemeContract {
  readonly id: string;
  /** Monotonic — bump on breaking CSS variable renames */
  readonly version: number;
  /**
   * CSS custom properties applied on workspace subtree root.
   * Keys MAY include or omit leading `--` (normalizer در provider).
   */
  readonly cssVariables: Readonly<Record<string, string>>;
  /**
   * Optional URL/path to workspace-owned CSS bundle (first-party only in 2.x).
   * Loaded by web bootstrap — not evaluated in Node.
   */
  readonly optionalStylesheet?: string;
}
```

**گسترش `WorkspacePlugin`:**

```typescript
export interface WorkspacePlugin {
  // ... existing fields (phase 0–1)
  readonly theme?: WorkspaceThemeContract;
}
```

**قوانین:**

1. `theme` **اختیاری** — starter می‌تواند فقط platform tokens استفاده کند.
2. کلیدهای `cssVariables` باید با prefix `--ws-` شروع شوند (validation SDK) — استثنا: document در پیوست.
3. `platform-core` **هرگز** `theme` نمی‌خواند — فقط `RenderPlan` با `uiHints` opaque.

### 5.4 نگاشت `RenderPlan` → UI (پل فاز ۱)

| `RenderFieldPlan.kind` | Primitive فاز ۲ | `uiHints` (opaque تا فاز ۳) |
|------------------------|-----------------|-----------------------------|
| `text` | `Input` / `Textarea` | `multiline?: boolean` |
| `number` | `Input` type number | `min`, `max` |
| `date` | placeholder `Input` | Jalali فاز ۶ |
| `enum` | `Select` | `options` از registry |
| `boolean` | `Checkbox` | — |
| `composite` | `FieldShell` + slot | `compositeId` → plugin widget فاز ۶ |

`platform-core` رنگ نمی‌شناسد؛ `uiHints` فقط برای renderer registry در web.

---

## 6. DAG و زیرفازها

```text
2.1 design-tokens (primitives + semantics + dark)
    ↓
2.2 WorkspaceThemeContract + plugin.theme validation
2.2.1 Theme ingress security (parse + assert)
    ↓
2.3 ui-primitives (semantic-only CSS)
    ↓
2.4 ThemeProvider chain (harness package)
    ↓
2.5 phase-2-guard + visual QA
    ↓
→ Phase 3.1 starter workspace + theme
```

| Sub-phase | PR label | وابستگی | PR اندازه هدف |
|-----------|----------|---------|----------------|
| 2.1 | `Phase: 2.1` | فاز ۱ ✅ | ≤ 600 خط (CSS + package scaffold) |
| 2.2 | `Phase: 2.2` | 2.1 | ≤ 400 خط |
| 2.3 | `Phase: 2.3` | 2.1 | ≤ 800 خط (per primitive PR if needed) |
| 2.4 | `Phase: 2.4` | 2.2, 2.3 | ≤ 500 خط |
| 2.5 | `Phase: 2.5` | 2.1–2.4 | guard + playground |

**Overlap مجاز:** 2.5 موازی تست‌های 2.3 (فقط guard).  
**Overlap ممنوع:** `apps/web` production (فاز ۳) · `packages/workspaces/denali` (فاز ۶) · تغییر `platform-core` به‌جز types/export اختیاری `uiHints` doc.

---

## 7. زیرفاز 2.1 — `packages/design-tokens`

### 7.1 هدف

تعریف **منبع حقیقت بصری platform** — مستقل از React و workspace.

### 7.2 ساختار پکیج (هدف)

```text
packages/design-tokens/
  package.json          # name: @app-tour/design-tokens
  src/
    primitives.css      # --spacing-*, --radius-*, raw palette scales
    semantics.css       # --color-surface, --color-text-primary, ...
    themes/
      light.css
      dark.css
    index.css           # @import chain
  dist/                 # copied or built CSS for consumers
  tokens.meta.json      # منبع حقیقت guard — فهرست نام متغیرهای CSS (§7.4.1)
```

### 7.3 قوانین نام‌گذاری

| لایه | پیشوند نمونه | مثال |
|------|--------------|------|
| Primitive | `--scale-`, `--space-` | `--space-4` |
| Semantic | `--color-`, `--font-` | `--color-border-subtle` |
| Workspace (در plugin) | `--ws-` | `--ws-color-accent` — **نه** در این پکیج |

### 7.4 Port از legacy

منبع **CSS:** [`legacy/packages/ui/src/tokens/light.css`](../legacy/packages/ui/src/tokens/light.css) و `dark.css` — **نه** وابستگی به `legacy/scripts/validate-design-tokens.js` یا `docs/10-product/design_system.md`.

**تغییرات هنگام port:**

1. حذف نام‌های وابسته به محصول (`--color-denali-*` اگر وجود داشت → semantic generic).
2. تفکیک فایل primitives vs semantics.
3. ثبت `theme-light` / `theme-dark` روی `html` (سازگاری با `ThemeProvider` آینده).

### 7.4.1 `tokens.meta.json` + `validate-design-tokens.mjs` (standalone)

**منبع حقیقت guard** — داخل `packages/design-tokens/tokens.meta.json` (بدون markdown خارجی):

```json
{
  "schemaVersion": 1,
  "themes": {
    "light": {
      "requiredVariables": ["--color-surface", "--color-text-primary"]
    },
    "dark": {
      "requiredVariables": ["--color-surface", "--color-text-primary"]
    }
  },
  "sharedVariables": ["--spacing-4", "--radius-sm"],
  "forbiddenPatterns": ["denali", "tour-green"]
}
```

**رفتار `scripts/guards/validate-design-tokens.mjs`:**

| گام | الزام |
|-----|--------|
| 1 | هر نام در `requiredVariables` / `sharedVariables` در CSS ترکیبی `src/themes/light.css` + `dark.css` + `semantics.css` **تعریف شده** باشد |
| 2 | هر `--*` تعریف‌شده در CSS (به‌جز comment) در `tokens.meta.json` ثبت شده باشد (**no orphan vars**) |
| 3 | `forbiddenPatterns` در نام متغیرها → **FAIL** |
| 4 | اختیاری CI: `TOKEN_COMPARE_REF` — هیچ نام token از base branch حذف نشود |

**ممنوع:** import یا read از `legacy/scripts/validate-design-tokens.js`، `docs/10-product/design_system.md`.

### 7.5 Exit criteria 2.1

- [x] `pnpm --filter @app-tour/design-tokens run build` (یا export CSS بدون compile)
- [x] `tokens.meta.json` کامل و هم‌خوان با CSS port شده
- [x] import در harness: `import "@app-tour/design-tokens/styles.css"`
- [x] `pnpm run validate-design-tokens` (یا فراخوانی از `phase-2:guard`) — **PASS**
- [x] `rg -i denali packages/design-tokens` → 0
- [x] depcruise: `design-tokens` ↛ workspaces, ↛ apps, ↛ legacy

### 7.6 dependency-cruiser (افزودنی)

```javascript
// افزودن به dependency-cruiser.config.js در PR 2.1
{
  name: "design-tokens-isolated",
  from: { path: "^packages/design-tokens" },
  to: { path: "^packages/(?!design-tokens)" },
},
```

---

## 8. زیرفاز 2.2 — `WorkspaceThemeContract` در SDK

### 8.1 هدف

قرارداد **brand سطح workspace** — قابل validate، versioned، بدون React.

### 8.2 کارها

| # | کار | فایل |
|---|-----|------|
| 1 | تعریف `WorkspaceThemeContract` | `workspace-sdk/src/theme/workspace-theme.contract.ts` |
| 2 | `theme?: WorkspaceThemeContract` روی `WorkspacePlugin` | `workspace-plugin.contract.ts` |
| 3 | validation: keys `--ws-*`, finite version, string values | `workspace-plugin-validation.ts` |
| 4 | `starterWorkspacePlugin` — `theme: workspaceThemePresets["platform-primary"]` | `reference/starter-workspace.plugin.ts` |
| 5 | unit tests — reject invalid keys, accept valid | `workspace-sdk.spec.ts` / `theme.spec.ts` |
| 6 | Theme ingress (§8.2.1) در `assertWorkspacePlugin` + `parseWorkspacePluginFromStorage` | `workspace-plugin-validation.ts` · `parse-workspace-plugin.ts` |

### 8.2.1 Theme Ingress Security (زیرفاز 2.2.1)

**هدف:** theme در plugin همان سطح حساسیت ingress canonical دارد — validate قبل از runtime، بدون اعتماد به storage خام.

**مسیرهای اجباری:**

```text
parseWorkspacePluginFromStorage(raw)
  → ingress sanitizer (existing)
  → assertWorkspacePlugin(sanitized)   // includes theme when present
```

**قوانین validation (`theme` وقتی موجود است):**

| Rule ID | الزام | خطا (نمونه) |
|---------|--------|-------------|
| T-1 | `theme.id` non-empty ASCII slug | `INVALID_THEME_ID` |
| T-2 | `theme.version` finite number ≥ 0 | `INVALID_THEME_VERSION` |
| T-3 | `Object.keys(cssVariables).length` ≤ **64** | `THEME_CSS_VARIABLE_LIMIT` |
| T-4 | هر key پس از normalize با `--ws-` شروع شود؛ ASCII `[a-z0-9-]` فقط | `INVALID_THEME_CSS_KEY` |
| T-5 | هر value: string، length ≤ **4096** | `INVALID_THEME_CSS_VALUE` |
| T-6 | value **ممنوع** شامل: `expression(`, `url(javascript`, `url(data:`, `<`, `>` | `UNSAFE_THEME_CSS_VALUE` |
| T-7 | `optionalStylesheet` اگر هست: relative path، بدون `..`، بدون `://` | `INVALID_THEME_STYLESHEET` |

**platform-core:** `PlatformWizardEngine.tryFromPlugin` / `create`+`tryInit` — `parseWorkspacePluginFromStorage(..., { includeTheme: false })` در فاز ۱؛ theme در SDK validate می‌شود ولی در engine **نادیده** (بدون خواندن CSS).

**تست‌های اجباری (ingress):** ردیف‌های T-1–T-7 در [پیوست F](#پیوست-f--ماتریس-تست-فاز-۲).

### 8.3 تفکیک از Tenant (فاز ۴)

| | Workspace theme | Tenant theme |
|---|-----------------|--------------|
| مالک | `WorkspacePlugin` | `tenant-kernel` / DB config |
| scope | همه tenantهایی که این workspace type دارند | یک سازمان |
| prefix CSS | `--ws-*` | `--color-primary*` (semantic override) |
| فاز implement provider | ۲ (contract) · ۳ (starter CSS) | ۴ |

Types tenant را می‌توان در `workspace-sdk` به‌صورت **stub** export کرد (`TenantThemeConfig` re-export doc) بدون وابستگی به legacy.

### 8.4 Exit criteria 2.2

- [x] `pnpm --filter @app-tour/workspace-sdk test` — tests جدید ≥ 5 (+ ingress theme ≥ 7 per پیوست F)
- [x] `assertWorkspacePlugin` + `parseWorkspacePluginFromStorage` با theme معتبر/نامعتبر (§8.2.1)
- [x] `platform-core` بدون تغییر رفتار (theme نادیده گرفته می‌شود)
- [x] export از `workspace-sdk` index
- [x] `platform-core` همچنان **بدون** dependency به `design-tokens`

---

## 9. زیرفاز 2.3 — `packages/ui-primitives`

### 9.1 هدف

کامپوننت‌های **generic** که فقط semantic tokens می‌خوانند — پایهٔ wizard shell فاز ۳.

### 9.2 حداقل سطح MVP (فاز ۲)

| Component | اولویت | legacy مرجع |
|-----------|--------|--------------|
| `Button` | P0 | `@tour/ui/Button` |
| `Input` | P0 | `@tour/ui/Input` |
| `FieldShell` | P0 | ترکیب `FormField` + label/error |
| `Select` | P1 | `@tour/ui/Select` — **Backlog** (فاز ۳، not Complete) |
| `Checkbox` | P1 | `@tour/ui/Checkbox` — **Backlog** (فاز ۳، not Complete) |
| `Alert` | P1 | `@tour/ui/Alert` — **✅ فاز ۲** |
| `Badge` | P2 | `@tour/ui/Badge` — **✅ فاز ۲** (subpath `./badge`؛ hygiene §9.3 remediated؛ token maps داخلی — بدون barrel export) |

### 9.3 ساختار پکیج

```text
packages/ui-primitives/
  package.json
  src/
    Button/
      Button.tsx
      Button.module.css
    Input/
    FieldShell/
    index.ts
  tsconfig.json
```

**styling:** CSS Modules + `var(--color-*)` only — **ممنوع** literal `#fff` در module (guard اختیاری در 2.5).

### 9.4 وابستگی‌ها

```json
{
  "dependencies": {
    "@app-tour/design-tokens": "workspace:*"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

**ممنوع:** `@app-tour/platform-core` در runtime primitive (جدا نگه دارید — renderer فاز ۳ وصل می‌کند).

### 9.5 Accessibility contract

هر primitive:

- `forwardRef` برای focus management
- `aria-*` برای FieldShell (`aria-invalid`, `aria-describedby`)
- focus visible با `--color-focus-ring`

### 9.6 Exit criteria 2.3

- [x] build + unit tests (React Testing Library یا snapshot سبک) ≥ 12 (۲۲+ unit + wiring test)
- [x] هر component در playground با light/dark (Storybook + `test:visual`)
- [x] depcruise: ui-primitives → design-tokens (+ `@app-tour/theme-react` برای ingress harness)
- [x] `rg "#[0-9a-fA-F]{6}" packages/ui-primitives/src` → 0 (hex فقط در stories/tests در صورت نیاز)

---

## 10. زیرفاز 2.4 — ThemeProvider chain (harness)

### 10.1 هدف

اثبات **cascade** سه‌سطحی بدون apps/web کامل.

### 10.2 گزینه‌های پیاده‌سازی

| گزینه | مسیر | tradeoff |
|-------|------|----------|
| A | `packages/theme-react/` | reusable از فاز ۳ — **پیشنهادی** |
| B | `apps/web-harness/` (Vite minimal) | سریع برای QA — optional |

### 10.3 API هدف (`@app-tour/theme-react`)

```typescript
export function PlatformThemeProvider(props: { mode: "light" | "dark"; children: React.ReactNode }): JSX.Element;
export function TenantThemeProvider(props: { theme: TenantThemeConfig; children: React.ReactNode }): JSX.Element;
export function WorkspaceThemeProvider(props: { theme: WorkspaceThemeContract; children: React.ReactNode }): JSX.Element;
```

**رفتار `WorkspaceThemeProvider`:**

1. ایجاد `div` با `data-workspace-theme={theme.id}`.
2. `style` از normalized `cssVariables`.
3. اگر `optionalStylesheet` — **فاز ۳** link tag؛ فاز ۲ فقط unit test style injection.

**رفتار `TenantThemeProvider` (mock):**

- port منطق [`build-tenant-theme-style.ts`](../legacy/apps/web/lib/tenant/build-tenant-theme-style.ts) به pure function در `theme-react` (بدون fetch).

### 10.4 Exit criteria 2.4

- [x] harness page: Button در هر سه لایه cascade (Storybook + `theme-react` provider tests)
- [x] test: override `--ws-color-accent` روی workspace subtree فقط (`test:visual` + ingress guard specs)
- [x] بدون import از `legacy/`

---

## 11. زیرفاز 2.5 — Visual QA + `phase-2-guard`

### 11.1 `phase-2-guard` + `phase-2:gate`

جزئیات blocking در [پیوست G](#پیوست-g--phase-2gate-الزامات-صریح). خلاصه: `phase-2:gate` = build + test + `guard:architecture` + `guard:import-boundary` + `guard:symlink` + `phase-2:guard`؛ ماتریس تست در [پیوست F](#پیوست-f--ماتریس-تست-فاز-۲).

### 11.2 Visual QA

- Storybook 8+ **یا** static HTML playground در `packages/ui-primitives/playground/`
- screenshot اختیاری — **نه** blocking فاز ۲ اولین PR

### 11.3 CI workflow

```yaml
# .github/workflows/phase-2-gate.yml (PR 2.5)
# runs: pnpm run phase-2:gate  (see Appendix G)
```

### 11.4 Exit criteria 2.5

- [x] `pnpm run phase-2:gate` سبز (یا معادل: `phase-2:guard` پس از build/test)
- [x] `reports/phase-2-gate-YYYY-MM-DD.json` با gitSha
- [ ] pre-commit یا `ci:integrity` شامل `phase-2:gate` کامل — **اختیاری**؛ `ci:integrity` فعلی integrity gate جداگانه دارد

---

## 12. آنچه در فاز ۲ ممنوع است

| # | ممنوع | به‌جای آن |
|---|--------|-----------|
| 1 | `apps/api` / Postgres | فاز ۳ |
| 2 | `packages/workspaces/denali` | فاز ۶ |
| 3 | ویزارد کامل + RHF canonical dual-write | فاز ۳ |
| 4 | تغییر رفتار `RuleEngine` / `validateCanonical` | فاز ۱ frozen |
| 4b | `platform-core` → `design-tokens` / `ui-primitives` | downstream-only visual |
| 5 | import static از workspace در shell | dynamic bootstrap فاز ۳ |
| 6 | Tailwind در primitives | CSS Modules |
| 7 | فونت production Vazirmatn در package | فاز ۳ `apps/web` |
| 8 | Module Federation marketplace | فاز ۷+ evaluate |

---

## 13. Definition of Done فاز ۲

**Phase 2 Security Seal (MAP):** **Satisfied via restricted subpath exports** — not “Fully satisfied” (archived breach: SB-01). See [MIGRATION-MAP § Security & Compliance](MIGRATION-MAP.md#security--compliance) and [Audit & Remediation History](MIGRATION-MAP.md#audit--remediation-history).

- [x] `@app-tour/design-tokens` — CSS light/dark + semantics documented
- [x] `@app-tour/ui-primitives` — Button, Input, FieldShell, Alert (**Complete** for §13)
- [ ] **Backlog (ui-primitives):** Select؛ Checkbox — فاز ۳ — [§13.1](#131-ممیزی-فاز-۲--backlog-نه-complete--نه-شکست-gate)
- [x] `WorkspaceThemeContract` + validation در SDK
- [x] `@app-tour/theme-react` — provider chain + tests + L-01 export allowlist (`verify:exports`)
- [x] `phase-2:gate` سبز — گزارش در `reports/phase-2-gate-*.json` (آخرین اجرا: `pnpm run phase-2:guard` / `phase-2:gate`)
- [x] depcruise rules برای پکیج‌های جدید
- [x] `platform-core` / `workspace-sdk` tests بدون regression (133+ کل monorepo test)
- [x] صفر `denali` در design-tokens / ui-primitives
- [x] سند mapping RenderPlan → primitive (§5.4) در PR آخر

### 13.1 ممیزی فاز ۲ — Backlog (نه Complete · نه شکست gate)

موارد زیر **عمداً Backlog** هستند — **Complete** محسوب نمی‌شوند، ولی **مانع `phase-2:gate` نیستند** مگر خلاف آن در PR ثبت شود.

| ID / موضوع | وضعیت | توضیح |
|------------|--------|--------|
| **P2-006** | **Backlog** (پذیرفته) | `rgba(...)` در `--shadow-*` داخل **`primitives.css` (منبع token)** — مجاز در لایه تعریف؛ خارج از §9.3 component modules. |
| **Select** | **Backlog** | P1 §9.2 — **فاز ۳**؛ **not Complete**. |
| **Checkbox** | **Backlog** | P1 §9.2 — **فاز ۳**؛ **not Complete**. |
| **P2-007** | **Complete** | `starterWorkspacePlugin.theme` = `workspaceThemePresets["platform-primary"]`؛ presets frozen؛ تست در `workspace-sdk`. |

**تکمیل شده در ممیزی (دیگر open نیست):** P2-001، P2-002، P2-003، P2-004، **P2-005** (§9.3 literals + map wiring — `ui-primitives/test/component-token-maps-wiring.spec.ts`)، **Badge** hygiene (semantic tokens؛ بدون `:global`)، P2-007، P2-008؛ **SB-01** (`./internal` breach) — [Audit & Remediation History در MAP](MIGRATION-MAP.md#audit--remediation-history).

### 13.2 Audit History (هم‌تراز با MAP)

| ID | Severity | Finding | Remediation | Status |
|----|----------|---------|-------------|--------|
| **SB-01** | **CRITICAL** | `@app-tour/theme-react/internal` exported unvalidated `normalizeWorkspaceCssVariables` and DOM mappers while docs claimed Safety Seal ✅. | Removed `./internal`; deleted `src/internal.ts`; `p2_theme_react_no_internal_export`. | **Remediated** |
| **SB-02** | **HIGH** | `dist/**` deep-import surface (“private” = not on index only). | L-01: `exports` = `.` only; `files` whitelist; `verify:exports` (build hook); `guard:artifact-surface` در `phase-2:gate`. پکیج `private` — tarball npm فقط `files`؛ باقی `dist/` on-disk = dev artifact monorepo. | **Remediated** |
| **SB-03** | **HIGH** | Harness helpers on production `.` export. | Stripped from `index.ts`; harness not in `exports`. | **Remediated** |

مرجع: [`audits/zero-debt-remediation-audit.md`](audits/zero-debt-remediation-audit.md) · [`audit-red-flags-phase-0.md`](archive/root-forensics/audit-red-flags-phase-0.md) · [`audits/phase-2-zero-debt-forensic-audit-2026-06-02.md`](audits/phase-2-zero-debt-forensic-audit-2026-06-02.md).

---

## 14. چک‌لیست ورود به فاز ۳

قبل از `Phase: 3.1`:

- [x] این سند — زیرفاز ۲.1–۲.5 (خروجی‌های hard §4.1 و exit criteria §7.5–§11.4 هم‌خوان با §13)
- [x] [`phase-1-platform-core.mdoc` §10](phase-1-platform-core.mdoc) — DoD **فنی** §10.1–10.2 + `phase-1:guard` closure (95/100) — `reports/phase-1-closure-readiness-*.md`
- [ ] [`phase-1-platform-core.mdoc` §10](phase-1-platform-core.mdoc) — MAP §14.1 **architect sign-off** (A1) — تنها مانع رسمی «Phase 1 Complete»
- [x] `starterWorkspacePlugin` می‌تواند `theme` اختیاری داشته باشد — **نمونه‌سازی شده** (`platform-primary` preset)
- [x] تیم توافق کرده: فاز ۳ اولین `packages/workspaces/starter` + `apps/*` است — [`MIGRATION-MAP.md` §11](MIGRATION-MAP.md#۱۱-فازبندی-migration) · `packages/workspaces/starter` · `apps/web` · `apps/api`
- [x] playbook: «هیچ `<input>` خام در shell wizard» — ESLint `no-restricted-syntax` + `apps/web/scripts/guard-no-raw-wizard-input.mjs` (P3-ENTRY-02)
- [x] **CASL:** `auth/ability.ts` + `auth/casl` (`defineAbilityFor`)؛ `WorkspaceThemeProvider` — `authz` + اختیاری `ability` (**هر دو** قبل ingress) — `providers.spec.tsx` ([§15](#15-phase-3-infrastructure--access-control))
- [x] **DB:** `accessibleByTourWhere` + `apps/api/docs/prisma-accessible-by.md` (مرجع Prisma `accessibleBy`) — `api-ability.spec.ts` + `test/casl/prisma-accessible-by-reference.spec.ts` (P3-E-DB-01)

---

## 15. Phase 3: Infrastructure & Access Control

> **نقش:** roadmap رسمی فاز ۳ برای **دسترسی و داده** — مکمل ویزارد/API در [`MIGRATION-MAP.md` §فاز ۳](MIGRATION-MAP.md#phase-3-infrastructure--access-control).  
> **پیش‌نیاز:** Theme Ingress Guard فاز ۲ ([§8.2.1](#821-theme-ingress-security-زیرفاز-221)) سبز — CASL **قبل از** ingress اجرا می‌شود، نه به‌جای آن.

فاز ۲ ثابت کرد *چه CSS* می‌تواند وارد subtree شود. فاز ۳ باید ثابت کند *چه actor* اجازه دارد آن CSS (و هر ردیف DB مرتبط) را ببیند.

### 15.1 Authorization Policy

| Principle | Rule |
|-----------|------|
| **Declarative only** | تمام قوانین RBAC/ABAC برای Workspaceها و Pluginها در **تعاریف CASL** داخل `@app-tour/workspace-sdk` — نه `if (user.role === 'admin')` در routeها |
| **Single SoT** | `packages/workspace-sdk/src/auth/ability.ts` تنها مرجع ability برای `apps/api`, `apps/web`, `@app-tour/theme-react` |
| **Core stays headless** | `platform-core` بدون CASL / بدون tenant — shell و API ability را inject می‌کنند |
| **Change control** | تغییر دسترسی = PR روی `ability.ts` + tests — نه پراکندگی در ۱۰ controller |

### 15.2 CASL Integration

**مسیر canonical:**

```text
packages/workspace-sdk/src/auth/ability.ts   ← central authority (فاز ۳.0)
packages/workspace-sdk/src/index.ts          ← export defineAbilityFor, AppAbility, subjects
```

**Entity coverage (حداقل):**

| CASL subject / entity | Typical actions | Notes |
|----------------------|-----------------|-------|
| `Workspace` | `read`, `update`, `publish`, … | scoped by `tenantId` + membership |
| `Tenant` | `read`, `manage`, … | SaaS boundary |
| `Plugin` | `install`, `configure`, `read` | workspace plugin registry |
| `WorkspaceTheme` | `access`, `update` | **required** for theme DOM path |

**Packages:**

- `@casl/ability` — در `workspace-sdk` (pure rules)
- `@casl/prisma` — در `apps/api` فقط ( `accessibleBy` )

### 15.3 Cross-Layer Security (CASL × Theme Ingress Guard)

دو لایه **متمایز** و **ترتیب‌دار**:

```text
Actor context
    → defineAbilityFor(context)
    → ability.can('access', 'WorkspaceTheme' | subject(...))   [CASL — فاز ۳]
    → validateWorkspaceThemeIngress(plugin, theme)              [Ingress — فاز ۲]
    → snapshotWorkspaceTheme
    → WorkspaceThemeProvider / workspaceThemeToStyle (sealed)
```

| If you skip… | Result |
|--------------|--------|
| CASL only | Safe CSS may leak to unauthorized tenant/user |
| Ingress only | Authorized user may inject unsafe CSS (فاز ۲ مسدود کرد) |
| Ingress before CASL | **ممنوع** — validation روی payloadای که actor حق ندیدن آن را دارد |

**الزام implementation (`@app-tour/theme-react`):**

`WorkspaceThemeProvider` **باید** (فاز ۳.3+) قبل از `useThemeIngressGuard` / `validateWorkspaceThemeIngress`:

1. `ability.can('access', workspaceThemeSubject)` را بررسی کند (ability از context/prop inject‌شده — نه import static role).
2. در صورت **false**: children را بدون workspace theme wrapper رندر کند یا `WorkspaceThemeAccessDenied` ثابت — **بدون** فراخوانی ingress.

```typescript
// Contract sketch — PR 3.3
export type WorkspaceThemeProviderProps = {
  plugin: WorkspacePlugin;
  theme?: WorkspaceThemeContract;
  ability: AppAbility; // from workspace-sdk
  workspaceThemeSubject: WorkspaceThemeSubject;
  children: ReactNode;
};
```

`ThemeProviderChain` همان ability را به `WorkspaceThemeProvider` پاس می‌دهد.

### 15.4 Database Guardrails

در فاز ۳ (`apps/api` + Postgres dev)، **همه** queryهای Prisma که دادهٔ multi-tenant برمی‌گردانند باید با **`accessibleBy(ability, 'ModelName')`** فیلتر شوند ([`@casl/prisma`](https://casl.js.org/v6/en/package/essentials/prisma)) تا leakage افقی بسته شود.

| Pattern | Required |
|---------|----------|
| `prisma.tour.findMany` | `where: { AND: [accessibleBy(ability).Tour, …filters] }` |
| `prisma.tour.update` | `where: accessibleBy(ability).Tour` |
| Raw SQL | **ممنوع** در فاز ۳ مگر با RLS + review (فاز ۴+) |

**تست اجباری:** integration با دو tenant fixture — actor A هرگز رکورد B را نمی‌خواند.

> RLS در فاز ۴ لایه دوم defense است؛ CASL در فاز ۳ **الزام application-layer** است.

### 15.5 زیرفاز هم‌تراز (MAP)

| MAP # | کار |
|-------|-----|
| **3.0** | `ability.ts` + tests + theme provider gate + نمونه `accessibleBy` |
| 3.1–3.5 | starter workspace, api, web, canonical, logging — per [MIGRATION-MAP.md](MIGRATION-MAP.md#فاز-۳--starter-workspace--apps-minimal) |

### 15.6 Exit criteria (ورود به 3.1+)

- [ ] `ability.ts` merged با rules برای Workspace / Tenant / Plugin
- [ ] Zero procedural role checks در `apps/api` routes نمونه (۳.2)
- [ ] `WorkspaceThemeProvider` + test: deny → ingress **not** called
- [ ] Prisma integration test با `accessibleBy`
- [ ] PR template `Phase: 3.0` به‌روز شده

---

## 16. پل به MIGRATION-MAP §5–§10

| § MAP | رابطه با فاز ۲ |
|-------|----------------|
| §3 Frontend enterprise | **این فاز** — پیاده‌سازی tokens + contract |
| §5 Infra | فاز ۲ بدون Docker |
| §7 Tenant | types tenant در 2.2 stub؛ provider واقعی ۴ |
| §8 Plugin versioning | `theme.version` هم‌راستا با `plugin.version` |
| §9 Trust | first-party CSS only |
| §10 Observability | فاز ۲ بدون structured log |

**فاز ۳ بعدی:** [`MIGRATION-MAP.md` §فاز ۳](MIGRATION-MAP.md#فاز-۳--starter-workspace--apps-minimal) — sub-phase **3.0 CASL** سپس `packages/workspaces/starter` با `theme/tokens.css` تحت `ability.can('access', 'WorkspaceTheme')`.

---

## 17. پیوست‌ها

### پیوست A — dependency graph هدف (فاز ۲+)

```text
design-tokens        → (none from packages)
workspace-sdk        → (no design-tokens — theme types + auth/ability.ts فاز ۳)
ui-primitives        → design-tokens
theme-react          → design-tokens, workspace-sdk (types)
platform-core        → workspace-sdk only (↓ downstream-only — ↛ design-tokens, ↛ ui-primitives)
workspaces/*         → workspace-sdk, platform-core, design-tokens (theme.css only)
apps/web             → theme-react, ui-primitives, platform-core, design-tokens (فاز ۳)
```

> **هم‌تراز [`MIGRATION-MAP.md` §2](MIGRATION-MAP.md#قانون-import-ci-blocking):** visual layer **downstream** از headless core — `platform-core` هرگز token CSS import نمی‌کند.

### پیوست B — دستورات verification

```bash
nvm use && corepack enable
pnpm install
pnpm build
pnpm test
pnpm run guard:architecture
pnpm run phase-2:gate    # پس از 2.5
rg -i denali packages/design-tokens packages/ui-primitives packages/theme-react
```

### پیوست C — PR template snippet

```markdown
Phase: 2.x

## Sub-phase (phase-2-design-system.md §7–11)
- [ ] …

## Visual anti-patterns (§3.2)
- [ ] V1–V7

## Tests added: N
```

### پیوست D — مراجع خارجی (خلاصه تحقیق)

- Microkernel / plugin host: contribution points، event bus نه direct plugin calls.
- Multi-tenant widgets: tenant config → enabled extensions؛ manifest registry.
- Loader strategies: first-party Module Federation / dynamic `import()` vs third-party iframe ([MAP §9](MIGRATION-MAP.md#۹-مدل-اعتماد-plugin--first-party-vs-third-party)).
- W3C Design Tokens community format — اختیاری برای نسخه بعد؛ فاز ۲ CSS vars کافی است.

### پیوست E — وقتی Denali می‌آید (فاز ۶)

- `packages/workspaces/denali/theme/tokens.css` — `--ws-*` overrides
- widgets composite — `uiHints.compositeId` → React lazy از plugin
- **بدون** تغییر `design-tokens` semantics — فقط workspace layer

### پیوست F — ماتریس تست فاز ۲

| ID | لایه | سناریو | انتظار |
|----|------|--------|--------|
| DT-1 | design-tokens | `validate-design-tokens` vs `tokens.meta.json` | PASS |
| DT-2 | design-tokens | orphan `--*` در CSS بدون meta entry | FAIL guard |
| DT-3 | design-tokens | `rg -i denali packages/design-tokens` | 0 |
| T-1 | workspace-sdk | theme بدون `--ws-` prefix | reject |
| T-2 | workspace-sdk | 65th cssVariable key | `THEME_CSS_VARIABLE_LIMIT` |
| T-3 | workspace-sdk | value با `expression(` | `UNSAFE_THEME_CSS_VALUE` |
| T-4 | workspace-sdk | `parseWorkspacePluginFromStorage` + valid theme | deep-freeze + pass |
| T-5 | workspace-sdk | `optionalStylesheet: "../../../etc/passwd"` | reject |
| T-6 | workspace-sdk | plugin بدون `theme` | pass (optional) |
| T-7 | workspace-sdk | homoglyph در key نام CSS | reject (ASCII-only) |
| UI-1 | ui-primitives | Button light/dark snapshot یا RTL class | render |
| UI-2 | ui-primitives | FieldShell `aria-invalid` | a11y attrs |
| TR-1 | theme-react | cascade platform → tenant mock → workspace | `--ws-*` scoped |
| TR-2 | theme-react | workspace override روی subtree only | sibling unchanged |
| PC-1 | platform-core | regression suite | **132+** pass، بدون import design-tokens |
| G-1 | guards | `phase-2:guard` | all checks PASS |

**حداقل شمارش (gate):** workspace-sdk theme/ingress ≥ **7** · ui-primitives ≥ **12** · theme-react ≥ **4** · design-tokens guard = **1** job.

### پیوست G — `phase-2:gate` (الزامات صریح)

**Root `package.json` (PR 2.5):**

```json
{
  "scripts": {
    "validate-design-tokens": "node scripts/guards/validate-design-tokens.mjs",
    "phase-2:guard": "node scripts/guards/phase-2-guard.mjs",
    "phase-2:gate": "pnpm build && pnpm test && pnpm run guard:architecture && pnpm run guard:import-boundary && pnpm run guard:symlink && pnpm run phase-2:guard"
  }
}
```

**`scripts/guards/phase-2-guard.mjs` — checks blocking:**

| # | Check | FAIL if |
|---|--------|---------|
| 1 | `pnpm --filter @app-tour/design-tokens run build` | dist/css missing |
| 2 | `validate-design-tokens.mjs` | tokens.meta.json drift |
| 3 | `pnpm --filter @app-tour/workspace-sdk test` | count < baseline (133 monorepo min؛ SDK theme tests present) |
| 4 | `pnpm --filter @app-tour/ui-primitives test` | count < **12** |
| 5 | `pnpm --filter @app-tour/theme-react test` | count < **4** |
| 6 | `pnpm run guard:architecture` | depcruise violation |
| 7 | `pnpm run guard:import-boundary` | AST boundary violation |
| 8 | `rg -i denali packages/design-tokens packages/ui-primitives packages/theme-react` | any match |
| 9 | `rg "design-tokens" packages/platform-core/package.json packages/platform-core/src` | platform-core must not depend on tokens |
| 10 | Write `reports/phase-2-gate-YYYY-MM-DD.json` | missing gitSha / failedChecks |

**CI:** `.github/workflows/phase-2-gate.yml` → `pnpm run phase-2:gate` on PRs با label `Phase: 2.x`.

**پس از DoD فاز ۲:** ادغام در `ci:integrity` / pre-commit (همان الگوی `phase-1:gate`).

---

**شروع:** [§7 زیرفاز 2.1](#7-زیرفاز-21--packagesdesign-tokens) پس از [`phase-1-platform-core.mdoc` §10](phase-1-platform-core.mdoc) + `pnpm run phase-1:gate` سبز.
