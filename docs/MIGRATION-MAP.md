# نقشهٔ مهاجرت app-tour — Hardened Compliance Contract

## Master Governing Policy

> **This block is the supreme policy layer for all phases.** It supersedes marketing language in phase guides, local READMEs, and ad-hoc CI shortcuts. When in conflict, halt and obtain **Architect** sign-off.

| Principle | Rule | Authority |
|-----------|------|-----------|
| **Phase closure** | No phase may be marked **Complete**, **Closed**, or **Zero-Debt Verified** unless its `phase-N.contract.spec.ts` suite passes the [**Paranoid Audit**](#paranoid-audit-definition) defined in [§13](#۱۳-architecture-breaking-points). Grep-only or count-only thresholds **cannot** satisfy closure. | [§14 Constitution](#۱۴-the-constitution-of-phases) · [§12 R1](#۱۲۱-grep-free-gates) |
| **Gate hardening** | Every new phase gate **must** be **isolated** (phase package targets only), include at least one **adversarial test** that attacks the phase’s core abstraction, and maintain a **1:1 Doc-Claim ↔ Code-Enforcement** map (Verification table). | [§14 Gate Hardening](#۱۴۲-gate-hardening-policy-mandatory) |
| **Forensic Drift** | Any PR that **weakens** a guard (strict check → warning, scope shrink, threshold floor drop, grep substitution for contract tests) triggers mandatory label **`forensic-drift`** and **Architect** human sign-off before merge. | [§14 Forensic Drift Override](#۱۴۳-the-forensic-drift-override) |
| **Doc honesty** | Every phase doc **must** include **§N.X Forensic Truth vs Marketing** listing every **Aspirational** (unenforced) requirement — before phase closure claims. | [§14 Self-Referencing Audit](#۱۴۴-self-referencing-audit-mandatory-phase-docs) |
| **Foundation vs integration** | **Foundation-Gate is pure-contract-only; Integration-Gate is cross-phase-trunk-integrity** (KS-01). | [§13 BP-01/BP-02](#۱۳-architecture-breaking-points) · [`phase-0-foundation.mdoc`](phase-0-foundation.mdoc) |
| **Compliance-by-Design** | Phases **1–7** inherit [§15](#۱۵-the-phase-gate-constitution)–[§18](#۱۸-documentation-truth) so Phase 0 rot (**Gate Drift**, **Scaffold Theater**, grep closure) cannot recur. | [§15](#۱۵-the-phase-gate-constitution) · [§16](#۱۶-forensic-drift-enforcement) · [§17](#۱۷-the-simplicity-hedge) · [§18](#۱۸-documentation-truth) |

**Anti-patterns this policy blocks:** **Scaffold Theater** (green CI without real isolation) · **Gate Drift** (full-monorepo checks masquerading as phase closure) · **Doc-Code Drift** (marketing DoD without `*.contract.spec.ts` proof) · **Complexity Trap** (abstractions without Simplicity Proof).

---

**وضعیت:** سند مرجع (North Star + فازبندی) · **سیاست اجرایی:** [§12 The Zero-Debt Covenant](#۱۲-the-zero-debt-covenant-mandatory-enforcement) · **Compliance-by-Design:** [§15](#۱۵-the-phase-gate-constitution)–[§18](#۱۸-documentation-truth) · **قانون اساسی فازها:** [§14](#۱۴-the-constitution-of-phases) — **grep-free · verified · scale-invariant · fail-closed**  
**جایگزین:** `legacy/map.md` (مهاجرت in-place متوقف شد)  
**آرشیو مرجع:** [`legacy/`](../legacy/)  
**North Star:** Platform logic = generic · Workspace logic = injectable · Tenant = security boundary  
**Top-level enforcement:** [§12 Protocol](#۱۲-protocol--hardened-compliance-contract) · [§14 Constitution](#۱۴-the-constitution-of-phases) · breaking points: [§13](#۱۳-architecture-breaking-points) · per-phase gates: [§11](#۱۱-فازبندی-migration)  
**Verification (R2):** `pnpm run guard:doc-sync` · `pnpm run doc-gate` · `phase-N:foundation-gate` / `phase-N:gate` per phase doc

### فهرست

| § | موضوع |
|---|--------|
| [Master Governing Policy](#master-governing-policy) | **Constitution injection** — Scaffold Theater · Gate Drift immunity |
| [۱](#۱-دید-کلی--چه-می‌سازیم) | دید کلی |
| [۲](#۲-لایه‌های-معماری) | لایه‌های معماری |
| [۳](#۳-frontend-enterprise--tokens-و-theme-هر-workspace) | Frontend tokens |
| [۴](#۴-workspaceplugin--چه-چیز-داخل-plugin-است) | WorkspacePlugin |
| [۵](#۵-infrastructure--سرویس‌های-واقعی-per-phase) | **Infrastructure (Postgres/Redis/MinIO)** |
| [۶](#۶-ارتباط-بین-ماژول‌ها--event-bus--outbox) | **Event bus & Outbox** |
| [۷](#۷-tenant-isolation--poolhybridrouting) | **Tenant hybrid + routing** |
| [۸](#۸-plugin-lifecycle--versioning) | **Plugin versioning** |
| [۹](#۹-مدل-اعتماد-plugin--first-party-vs-third-party) | **Plugin trust model** |
| [۱۰](#۱۰-observability--audit) | **Observability & audit** |
| [۱۱](#۱۱-فازبندی-migration) | فازبندی · [Phase 3 CASL](#phase-3-infrastructure--access-control) |
| [۱۲](#۱۲-the-zero-debt-covenant-mandatory-enforcement) | **§12 Zero-Debt Covenant** — **Hardened Compliance Contract** (grep-free · verified · scale-invariant · fail-closed) |
| [۱۳](#۱۳-architecture-breaking-points) | **§13 Architecture Breaking Points** · [**Paranoid Audit**](#paranoid-audit-definition) |
| [۱۴](#۱۴-the-constitution-of-phases) | **§14 Constitution of Phases** — closure law · gate hardening · forensic drift |
| [۱۵](#۱۵-the-phase-gate-constitution) | **§15 Phase Gate Constitution** — `phase-N.contract.spec.ts` mandatory |
| [۱۶](#۱۶-forensic-drift-enforcement) | **§16 Forensic Drift Enforcement** — Paranoid Audit · Purity Score ≥ 8 |
| [۱۷](#۱۷-the-simplicity-hedge) | **§17 Simplicity Hedge** — anti-overengineering |
| [۱۸](#۱۸-documentation-truth) | **§18 Documentation Truth** — Verification table = CI 1:1 |
| [۱۹–۲۳](#۱۹-dag-وابستگی-فازها) | DAG · Guardrails · platform DoD |
| [Security & Compliance](#security--compliance) | **Theme ingress · current controls** |
| [Audit & Remediation History](#audit--remediation-history) | **Phase 2 breach (SB-01) · post-phase fixes · [forensic audit](audits/phase-2-zero-debt-forensic-audit-2026-06-02.md)** |
| [۲۴](#۲۴-future-proofing-ai--chat-integration) | **AI & Chat (future)** |
| [۲۵](#۲۵-phase-protocol-acknowledgment) | **Phase protocol acknowledgment** (points to §12) |
| [۲۶](#۲۶-documentation-governance--dod) | **Documentation Governance & DoD** (Docs-as-Code · Markdoc · Doc-Gate) |

> **Guard change rule:** Any edit to `phase-N-guard.mjs`, `phase-N:gate`, or phase CI workflows requires [Forensic Audit approval](#۱۲۱۰-mandatory-sync--phase-gate-guard-changes) per §12.10 — and **`forensic-drift`** label if the change weakens enforcement ([§14.3](#۱۴۳-the-forensic-drift-override)).

---

## ۱. دید کلی — چه می‌سازیم؟

**app-tour** یک پلتفرم SaaS **فوق‌سازمانی (enterprise)** برای اپراتورهای تور است:

| بعد | معنی |
|-----|------|
| **Multi-tenant** | هر سازمان (tenant) داده و دسترسی جدا — RLS، subdomain، billing |
| **Multi-App Deployment** | Each workspace consists of 3 distinct apps: Marketing (Public), User-Portal (Protected), and Admin-Panel (Protected) to ensure complete SEO, security, and performance isolation. |
| **Workspace = Plugin** | هر مدل کسب‌وکار (Denali، Urban، …) package مستقل با contract واحد |
| **Core بدون رسوخ** | هیچ نام، فیلد، استایل، یا قانون Denali در `platform-core` / shell |
| **Frontend enterprise** | design tokens پلتفرم + theme قابل override در هر workspace |
| **Canonical SoT** | یک state برای ویزارد و persist — نه dual-write |

**اولین workspace محصول:** **Denali** (تور کوهنوردی، لجستیک، مالی، …) — فیلدها و ساختار مالی از [`legacy/`](../legacy/) **port** می‌شوند، نه copy به core.

**ترتیب build:** Denali = اولین **محصول**، نه اولین **کد در core**. قبل از Denali: engine + starter plugin + tenant + tokens.

---

## ۲. لایه‌های معماری

```text
┌─────────────────────────────────────────────────────────────────┐
│  Tenant (SaaS boundary)                                         │
│  subdomain · RLS · users · roles · billing · tenant theme hook   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  apps/  (thin shell — bootstrap only)                           │
│  api:  plugin registry · validate(canonical) · generic CRUD      │
│  web:  wizard shell · ThemeProvider chain · plugin loader      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  packages/platform-core  (ZERO workspace · ZERO design-tokens)    │
│  FieldRegistryEngine · RuleEngine · StepEngine · RenderPlan       │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  packages/workspace-sdk  (contract + CASL authority)            │
│  WorkspacePlugin · CanonicalDocument · WorkspaceThemeContract   │
│  ability.ts — Workspace / Tenant / Plugin access (فاز ۳)        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 packages/workspaces/     packages/workspaces/    packages/design-tokens/
 denali/                  urban/ (بعداً)           (platform tokens)
   registry · rules         …                      workspace overrides
   widgets · theme          …
   finance slice
```

### قانون import (CI blocking)

```text
design-tokens        → (هیچ workspace / platform-core / workspace-sdk)
workspace-sdk        → (بدون design-tokens — theme contract types در SDK خودش)
platform-core        → workspace-sdk فقط (headless — ↛ design-tokens)
ui-primitives        → design-tokens (+ react peer)
theme-react          → design-tokens, workspace-sdk (types)
workspaces/*         → workspace-sdk, platform-core, design-tokens (theme.css فقط)
apps/*               → bootstrap: theme-react, ui-primitives, platform-core, design-tokens
platform-core        ↛ workspaces/* · ↛ design-tokens · ↛ ui-primitives
workspace-sdk        ↛ workspaces/* · ↛ design-tokens
apps/web (shell)     ↛ workspaces/*  (فقط dynamic bootstrap / lazy import)
```

---

## ۳. Frontend enterprise — tokens و theme هر workspace

هر workspace می‌تواند **ظاهر، برند، و حتی چیدمان shell** متفاوت داشته باشد؛ core فقط **مکانیزم** را می‌دهد، نه رنگ Denali.

### ۳.۱ سه سطح token

| سطح | پکیج | مثال |
|-----|------|------|
| **Platform primitives** | `packages/design-tokens` | `--spacing-4`, `--font-size-md`, `--radius-sm` |
| **Platform semantics** | `packages/design-tokens` | `--color-surface`, `--color-text-primary`, `--color-border` |
| **Workspace brand** | `packages/workspaces/<id>/theme` | `--ws-color-accent`, `--ws-font-display`, `--ws-logo-url` |

### ۳.۱.۱ TypeScript types (generated)

نام قدیمی **`tokens.generated.ts`** در مستندات اولیه به مسیر واقعی زیر نگاشت می‌شود:

| فایل | محتوا |
|------|--------|
| `packages/design-tokens/src/generated/tokens.ts` | `SemanticCssVariableName`, `SharedCssVariable`, `LightThemeCssVariable`, `DarkThemeCssVariable`, `PlatformCssVariable` |
| `packages/design-tokens/src/generated/semantic-tokens.ts` | `semanticTokenVars`, `semanticVar()`, `SemanticTokenKey` |

**منبع حقیقت تولید (do not edit by hand):** [`packages/design-tokens/scripts/generate-tokens.mjs`](../packages/design-tokens/scripts/generate-tokens.mjs)

- ورودی: `src/semantics.css` (نام‌های semantic) + `tokens.meta.json` (ثبت platform/theme vars)
- خروجی: هر دو فایل در `src/generated/` — در `pnpm build` قبل از `tsc` اجرا می‌شود
- فایل‌های legacy `tokens.generated.ts` / `tokens.d.ts` عمداً حذف می‌شوند

**Import برای consumers:**

```typescript
// ترجیح: main entry (شامل SemanticCssVariableName)
import type { SemanticCssVariableName, PlatformCssVariable, semanticVar } from "@app-tour/design-tokens";

// جایگزین: subpath types-only bundle
import type { SemanticCssVariableName } from "@app-tour/design-tokens/tokens";
```

### ۳.۲ زنجیره ThemeProvider (web)

```text
PlatformThemeProvider     ← design-tokens (پایه)
  └ TenantThemeProvider   ← tenant settings (لوگو، accent اختیاری)
       └ WorkspaceThemeProvider  ← از WorkspacePlugin.theme
            └ WizardShell / Renderer
```

- **`platform-core`** headless است — `RenderPlan` بدون CSS؛ semantic tokens را **`ui-primitives` / web renderer** می‌خوانند (`--color-surface`)، نه `--denali-green`.
- **workspace plugin** می‌تواند `theme?: WorkspaceThemeContract` و **custom widgets** export کند.
- دو workspace کنار هم: همان engine، **CSS variables متفاوت** + widgetهای اختصاصی در plugin.

### ۳.۳ قرارداد theme در SDK (فاز ۲.۲ — نه فاز ۱)

`WorkspacePlugin` علاوه بر registry/rules شامل:

```typescript
// شکل هدف — در workspace-sdk (جزئیات: phase-2-design-system.md §8 + §8.2.1)
interface WorkspaceThemeContract {
  readonly id: string;
  readonly version: number;
  readonly cssVariables: Readonly<Record<string, string>>; // keys --ws-*
  readonly optionalStylesheet?: string; // first-party relative path — فاز ۳+ load
}

interface WorkspacePlugin {
  // … registry, rules, wizard, validation, lifecycle
  readonly theme?: WorkspaceThemeContract;
}
```

### ۳.۴ ساختار پیشنهادی `apps/web`

```text
apps/web/
  app/                    # Next.js routes — generic
  src/
    shell/                # layout، nav — بدون Denali
    wizard/               # WorkspaceWizardHost (loader)
    providers/            # Theme chain
    bootstrap/            # registerWorkspacePlugins()
packages/
  design-tokens/
    src/
      primitives.css
      semantics.css
      themes/
      generated/
        tokens.ts              # platform/theme unions (نام قدیمی: tokens.generated.ts)
        semantic-tokens.ts     # semantic map + semanticVar()
    scripts/
      generate-tokens.mjs      # منبع حقیقت — تولید src/generated/*.ts
      build.mjs                # bundle CSS → dist/index.css
    tokens.meta.json           # منبع حقیقت guard (با generate-tokens هم‌خوان)
  ui-primitives/          # Button, Input, FieldShell, Alert, Badge (فاز ۲) — subpath exports; Select/Checkbox → فاز ۳
  workspaces/denali/
    theme/tokens.css
    widgets/              # DenaliPeakField, …
```

**ممنوع در shell:** import مستقیم از `workspaces/denali` — فقط registry/bootstrap.

### ۳.۵ Application Structure

هر tenant از **سه اپلیکیشن جدا** تشکیل می‌شود (Marketing، User-Portal، Admin-Panel). هر سه **thin shell** هستند: منطق ویزارد، قوانین فیلد، و برند workspace در shell نیست.

| App | دسترسی | نقش |
|-----|--------|-----|
| **Marketing** | Public | SEO، landing، محتوای عمومی — بدون session اجباری |
| **User-Portal** | Protected | اپراتور / مشتری tenant — ویزارد و جریان‌های محصول |
| **Admin-Panel** | Protected | مدیریت tenant، تنظیمات، نقش‌ها |

**تفکیک context در runtime:**

```text
Request (Host / Subdomain)
        │
        ▼
  tenant-kernel          ← resolve tenant identity · RLS context · routing
        │
        ├── workspace plugin registry (which WorkspacePlugin is active)
        ├── tenant theme / settings hooks
        └── app role (marketing | user-portal | admin-panel)
        │
        ▼
  apps/* thin shell      ← bootstrap فقط: ThemeProvider chain · plugin loader · routes
```

- **Marketing، User-Portal، Admin-Panel** هیچ‌کدام plugin workspace را به‌صورت static import نمی‌کنند؛ context (plugin + tenant) از **tenant-kernel** بر اساس **Host/Subdomain** درخواست resolve می‌شود.
- جداسازی اپ‌ها: boundary امنیتی (Protected vs Public)، SEO (Marketing بدون bundle اپراتور)، و performance (chunk و deploy مستقل).
- `apps/web` در فاز ۳ به‌عنوان اولین shell؛ در production هر نقش می‌تواند deploy جدا با همان bootstrap contract داشته باشد.

### ۳.۶ Authentication & Data Hydration

Authentication must be shared across the 3 apps (Marketing, User-Portal, Admin-Panel) via a unified session/JWT.

**Flow:** Users browse content in the Marketing app (public). Upon initiating a protected action (e.g., registration or tour creation), the user is routed to the User-Portal.

**Requirement:** The system must automatically hydrate the wizard forms with the user's session profile (canonical data) if already authenticated, ensuring a seamless progressive engagement flow. This applies consistently to all workspace plugins.

| الزام | معنی |
|--------|------|
| **Session واحد** | یک JWT / session cookie domain-scoped برای tenant (مثلاً `*.tenant.example.com`) — قابل استفاده در هر سه اپ |
| **Marketing → Portal** | CTAهای محافظت‌شده (ثبت‌نام، ساخت تور، …) redirect به User-Portal با `returnUrl` و همان tenant context |
| **Hydration ویزارد** | اگر session معتبر است، API قبل از render اولین step — **canonical profile** را بارگذاری و به `CanonicalDocument` / prefill map می‌کند |
| **همه workspaceها** | رفتار hydration در **platform shell** است؛ هر `WorkspacePlugin` از همان canonical SoT بهره می‌برد، نه cache محلی per-plugin |
| **Admin-Panel** | همان session/JWT؛ نقش و RBAC جدا از «logged in» — authorization بعد از authentication |

```text
Marketing (public browse)
    │
    │  protected action (register · create tour · …)
    ▼
User-Portal (+ optional Admin-Panel for ops)
    │
    ├─ session/JWT valid? ──yes──► hydrate wizard from canonical profile
    │                              (all workspace plugins)
    └─ no session ──► auth flow ──► then hydrate on success
```

**مرز با §7.4:** tenant از Host/Subdomain؛ session از auth issuer tenant-scoped — هر دو قبل از handler اجباری.

---

## ۴. WorkspacePlugin — چه چیز داخل plugin است؟

| بخش | محل | core می‌داند؟ |
|-----|-----|----------------|
| Field registry | plugin | فقط از contract |
| Rule matrix | plugin | فقط از contract |
| Wizard steps / rail | plugin | فقط از contract |
| Custom widgets | plugin | renderer generic + slot |
| Validation / lifecycle | plugin | API از contract |
| Theme / brand tokens | plugin | ThemeProvider |
| Finance rules (workspace-specific) | plugin یا `denali/finance` | API generic ledger + plugin hooks |

**Capabilities:**

- The WorkspacePlugin architecture supports content management (e.g., Blog/SEO pages) natively. Marketing pages are rendered via the Public Marketing App using the same WorkspacePlugin contract as the Admin-Panel. This ensures that content managed in the Admin-Panel is instantly SEO-indexed in the Marketing App while maintaining strict tenant-based isolation.

**Denali** از legacy می‌آورد: `legacy/packages/denali-domain/`, contracts مالی، smoke specs — همه زیر `packages/workspaces/denali/`.

---

## ۵. Infrastructure — سرویس‌های واقعی per phase

> **قانون:** از فاز ۳ به بعد، exit criteria فاز با **mock جایگزین سرویس واقعی** پاس نمی‌شود (به‌جز unit testهای pure).

### ۵.۱ جدول سرویس‌ها

| سرویس | نقش | فاز شروع | واقعی / Docker |
|--------|-----|----------|----------------|
| **Node 24 + pnpm** | build, test, guard | ۰ | محلی |
| **Postgres 16** | persist tours, tenants, RLS | **۳** (dev) · **۴** (e2e اجباری) | `docker compose` |
| **Redis 7** | session, cache, OTP, rate limit | **۴** | `docker compose` |
| **MinIO** | object storage (عکس تور، receipt) | **۶** (Denali photos) | `docker compose` |
| **Mailhog / SMTP dev** | invite, OTP dev | ۴ (اختیاری) | docker |

### ۵.۲ docker-compose (هدف — فاز ۳.۰)

```text
infra/
  docker-compose.dev.yml    # postgres + redis (+ minio از فاز ۶)
  .env.example
```

| سرویس | پورت host (پیشنهاد) | env |
|--------|---------------------|-----|
| Postgres | `5433→5432` | `DATABASE_URL=postgres://app:app@localhost:5433/app_tour` |
| Redis | `6379` | `REDIS_URL=redis://localhost:6379` |
| MinIO | `9002` API · `9001` console | `S3_ENDPOINT=http://localhost:9002` |

**مرجع پورت legacy:** [`legacy/AGENTS.md`](../legacy/AGENTS.md) — همان convention برای کاهش سردرگمی.

### ۵.۳ per-phase — چه باید «واقعی» باشد

| فاز | infra الزامی | exit «real» |
|-----|--------------|-------------|
| ۰–۱ | هیچ | unit + guard کافی |
| ۲ | هیچ | Storybook/local فقط |
| **۳** | Postgres dev برای `POST /tours` | integration test روی DB واقعی |
| **۴** | Postgres + Redis | tenant isolation e2e · `SET LOCAL app.current_tenant_id` |
| ۵ | Postgres (migration) | migration up/down روی DB واقعی |
| **۶** | + MinIO | upload photo e2e · finance integration |
| ۷ | full stack | load/smoke روی compose کامل |

### ۵.۴ دستورات هدف (پس از فاز ۳)

```bash
pnpm infra:up      # docker compose -f infra/docker-compose.dev.yml up -d
pnpm infra:down
pnpm e2e:api       # needs infra:up
```

### ۵.۵ ممنوع در DoD فاز

- In-memory DB به‌عنوان **تنها** proof فاز ۳+
- `backend-e2e` سبز با skip وقتی Docker down است (skip فقط در unit)
- commit `.env` با secret — فقط `.env.example`

---

## ۶. ارتباط بین ماژول‌ها — Event bus & Outbox

Core generic · workspace plugin · **bounded context**های platform (tours, finance, registrations) با **قرارداد** صحبت می‌کنند، نه import مستقیم domain یکدیگر.

### ۶.۱ الگو

```text
┌─────────────┐     domain event      ┌─────────────┐
│ tours       │ ───────────────────►  │ finance     │
│ (generic)   │   via outbox          │ (ledger)    │
└─────────────┘                       └─────────────┘
        │                                       ▲
        └──────── WorkspacePlugin hooks ────────┘
              (validation / publish policy — داخل plugin)
```

| مکانیزم | محل | فاز |
|---------|-----|-----|
| **In-process event bus** | `packages/platform-events` یا `apps/api/common/events` | **۴** |
| **Transactional outbox** | Postgres table `outbox_events` | **۵** |
| **Idempotency store** | Redis یا Postgres (مثل legacy) | **۴** |

### ۶.۲ قوانین

1. workspace plugin **event publish نمی‌کند** مستقیم به finance — API orchestration + plugin **hooks** (`lifecycle`, `validation`).
2. cross-tenant event **ممنوع** — `tenant_id` روی every outbox row.
3. consumer idempotent — `event_id` + dedupe.

### ۶.۳ مرجع legacy

- `legacy/apps/api/src/common/events/`
- finance transactional outbox checks در `legacy/scripts/check-finance-transactional-outbox.mjs`

**Exit فاز ۵:** یک event «TourCreated» از API تا handler ثبت‌شده با outbox test.

---

## ۷. Tenant isolation — Pool، Hybrid، Routing

### ۷.۱ مدل پیش‌فرض (فاز ۴–۵)

**Shared schema + `tenant_id` + RLS** — پیش‌فرض B2B SaaS برای app-tour.

```sql
-- session context (هر request)
SET LOCAL app.current_tenant_id = '<uuid>';

CREATE POLICY tenant_isolation ON tours
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
```

- composite index: `(tenant_id, …)` leading edge
- app-level filter **و** RLS (RLS = safety net، نه جایگزین app auth)

### ۷.۲ Hybrid tier (فاز ۷+ — enterprise contract)

| Tier | isolation | trigger |
|------|-----------|---------|
| **Standard** | pool + RLS | default signup |
| **Enterprise** | dedicated DB یا schema | sales / compliance |

**Routing layer** (از فاز ۴ design، فاز ۷ implement):

```typescript
// packages/tenant-kernel — TenantConnectionRouter
interface TenantRoute {
  readonly tenantId: string;
  readonly tier: "pool" | "silo";
  readonly databaseUrl: string; // pool cluster vs dedicated
}
```

- جدول `tenant_routes` — **قبل از** اولین enterprise customer schema آماده
- application code یکسان؛ فقط connection resolver عوض می‌شود

### ۷.۳ Tenant resolution (web + api)

| لایه | مکانیزم |
|------|---------|
| Web | subdomain `{tenant}.localhost:3000` |
| API | `Host` header + `tenant-kernel` |
| Jobs | `tenant_id` explicit در payload |

**مرجع:** `legacy/apps/api/test/e2e/subdomain-multi-tenant.e2e-spec.ts`

### ۷.۴ Endpoint Isolation & Context

All API requests across the 3 apps (Marketing, User-Portal, Admin-Panel) must be resolved via the Tenant-Kernel based on the Host/Subdomain. No endpoint shall execute without an enforced `tenant_id` context. Data isolation is guaranteed at the database level via RLS, ensuring that even if apps share an API base path, they are logically and security-isolated by the tenant identity.

| الزام | معنی |
|--------|------|
| **Tenant-Kernel first** | هر request از Marketing / User-Portal / Admin-Panel قبل از handler → resolve tenant از Host/subdomain |
| **`tenant_id` اجباری** | middleware یا guard معادل — بدون context معتبر → ۴۰۱/۴۰۳، نه اجرای business logic |
| **RLS safety net** | `SET LOCAL app.current_tenant_id` + policies روی جداول tenant-scoped ([§7.1](#۷۱-مدل-پیش‌فرض-فاز-۴۵)) |
| **مسیر مشترک API** | یک base path (مثلاً `/api/v2`) مجاز است؛ جداسازی منطقی/امنیتی با **هویت tenant**، نه با deploy جدا |

---

## ۸. Plugin lifecycle & versioning

### ۸.۱ semver contract

```typescript
interface WorkspacePlugin {
  readonly id: WorkspacePluginId;
  readonly version: number;        // monotonic int — bump on breaking registry
  readonly contractVersion: 1;     // SDK major — bump = adapter layer
  readonly supportedWorkspaceTypes: readonly WorkspaceTypeId[];
  // ...
}
```

| تغییر | bump |
|--------|------|
| فیلد جدید optional در registry | `version` minor (plugin) |
| rename field id / breaking rule | `version` major + migration adapter |
| `WorkspacePlugin` shape breaking | `contractVersion` در SDK |

### ۸.۲ Registry در API

```typescript
// apps/api — compile-time first-party; runtime manifest later
WorkspacePluginRegistry.register({
  pluginId: "denali",
  pluginVersion: 12,
  contractVersion: 1,
  loader: () => import("@app-tour/workspace-denali"),
});
```

### ۸.۳ Canonical schema migration

- `canonical_data.schemaVersion` per workspace
- plugin export: `migrateCanonical(v: number, data: unknown): CanonicalDocument`
- API: dual-read → write new version only (فاز ۶ cutover)

**ممنوع:** breaking registry change بدون migration path و بدون test.

---

## ۹. مدل اعتماد plugin — First-party vs Third-party

### ۹.۱ فاز ۶–۷: First-party only

| ویژگی | app-tour فعلی |
|--------|----------------|
| محل plugin | `packages/workspaces/*` در monorepo |
| load | compile-time / dynamic `import()` |
| trust | full — همان repo، همان CI |
| sandbox | **نیاز نیست** |

### ۹.۲ آینده (optional — بعد از DoD پلتفرم)

اگر plugin **شخص ثالث** خواستید:

| گزینه | tradeoff |
|--------|----------|
| npm private package + allowlist | ساده؛ trust به registry |
| WASM sandbox | isolation قوی؛ هزینه dev |
| separate worker process | مثل micro-frontend backend |

**تا آن زمان:** فقط `@app-tour/workspace-*` در bootstrap allowlist.

---

## ۱۰. Observability & Audit

> observability فقط فاز ۷ نیست — **حداقل viable از فاز ۳**؛ کامل در ۷.

### ۱۰.۱ per-phase

| فاز | حداقل |
|-----|--------|
| **۳** | structured JSON log · `request_id` · health `/internal/ops/health` |
| **۴** | log `tenant_id` (redacted PII) · auth failure metric |
| **۵** | audit table `audit_events` (who, tenant, action, entity) |
| **۶** | finance mutation audit · trace id cross API |
| **۷** | rate limits · alert runbook · (optional) OpenTelemetry |

### ۱۰.۲ فیلدهای log استاندارد

```json
{
  "level": "info",
  "requestId": "…",
  "tenantId": "…",
  "workspaceType": "denali",
  "phase": "api",
  "msg": "tour.created"
}
```

### ۱۰.۳ مرجع legacy

- `legacy/apps/api/src/common/audit/`
- `legacy/scripts/verify-production-log-sample.mjs`

---

## ۱۱. فازبندی migration

> **قانون:** فاز N+1 شروع نمی‌شود تا CI فاز N سبز باشد.  
> **PR:** در description بنویسید `Phase: N.M`.

### فاز ۰ — Foundation & Contract

> **راهنمای کامل:** [`phase-0-foundation.md`](phase-0-foundation.md) — sub-phase 0.1–0.6، درس legacy، exit criteria، پیوست‌ها  
> **Hardening:** Integration foundation honesty — claims without `scripts/guards/` proof are **Aspirational** per [§12.2](#۱۲۲-verification-as-code).

| # | کار | Exit | وضعیت |
|---|-----|------|--------|
| 0.1 | آرشیو `legacy/` + ایزولاسیون معماری | [`legacy/`](../legacy/) جدا از محصول؛ `apps/*` در trunk (فاز ۳+) — **خارج** از foundation-gate | ✅ |
| 0.2 | `@app-tour/workspace-sdk` + starter reference | build + [`test:phase-0`](../packages/workspace-sdk/test/phase-0.contract.spec.ts) (**114+** unit tests + 5 invariant manifest) | ✅ |
| 0.3 | `dependency-cruiser` import law | foundation: scoped depcruise در `phase-0-guard` · integration: `guard:architecture` | ✅ |
| 0.4 | docs: MIGRATION-MAP + phase-0 + phase-1 | merge | ✅ |
| 0.5 | CI `phase-0-gate` (push + PR) | job **Phase 0 foundation gate** → `test:phase-0` + scoped guards | ✅ |
| 0.6 | `baseline:metrics` + JSON report | informational (`reports/`) — **not** required for foundation closure | ✅ |

**Enforcement (§12):**

| Rule | Phase 0 obligation | Verification command |
|------|-------------------|----------------------|
| **R5** Lessons — Scaffold Theater | Do not label “Foundation closed” from integration-only green; trunk apps/packages build only in `phase-0:integration-gate` | `pnpm run phase-0:foundation-gate` · [`phase-0.contract.spec.ts`](../packages/workspace-sdk/test/phase-0.contract.spec.ts) |
| **R2** Verification-as-Code | Phase 0 closure = `phase-0.contract.spec.ts` aggregator | `pnpm run test:phase-0` · `pnpm run guard:doc-sync` |

**قانون:** فاز ۱ شروع نمی‌شود تا چک‌لیست ورود در [`phase-0-foundation.md`](phase-0-foundation.md) همه ✅ **و** [§12](#۱۲-the-zero-debt-covenant-mandatory-enforcement) رعایت شده باشد.

---

### فاز ۱ — Platform core (engine) — **Closed: Zero-Debt Verified**

> **Status:** **Closed: Zero-Debt Verified** (2026-06-03) — forensic: [`audits/phase-1-forensic-audit.md`](../audits/phase-1-forensic-audit.md) · sign-off: [`reports/phase-1-architect-signoff-checklist-2026-06-03.md`](../reports/phase-1-architect-signoff-checklist-2026-06-03.md) · gate: `pnpm run phase-1:gate` (16/16) @ `7000685`  
> **راهنمای کامل:** [`phase-1-platform-core.md`](phase-1-platform-core.md) — sub-phase 1.1–1.6، API engines، ≥148 tests، anti-patterns legacy  
> **Hardening:** Engine invariants require adversarial specs — not grep-only closure.

| # | کار | Exit |
|---|-----|------|
| 1.1 | `packages/platform-core` scaffold | build + depcruise rules |
| 1.2 | `FieldRegistryEngine` | ≥ 6 tests |
| 1.3 | `RuleEngine` | ≥ 8 tests |
| 1.4 | `render-plan.steps` (not `StepEngine` class) | ≥ 6 tests |
| 1.5 | `buildRenderPlan` / `render-plan.ts` (headless) | ≥ 8 tests |
| 1.6 | `PlatformWizardEngine` + bootstrap validation + `phase-1:guard` | ≥ 148 tests · 16 guard checks |

**Enforcement (§12):**

| Rule | Phase 1 obligation | Verification command |
|------|-------------------|----------------------|
| **R1** Grep-Free Gates | `no-legacy-imports` / workspace boundaries proven by **depcruise +** `test/adversarial-*.spec.ts` — not `rg` alone | `pnpm run guard:architecture` · `pnpm run test:adversarial` · `pnpm run phase-1:gate` |

**عمداً نکنید:** Next.js، Denali، DB، React در platform-core — جزئیات در [`phase-1-platform-core.md` §7](phase-1-platform-core.md#7-آنچه-در-فاز-۱-ممنوع-است).

---

### فاز ۲ — Design tokens + UI primitives — **Closed: Zero-Debt Verified**

> **Status:** **Closed: Zero-Debt Verified** (2026-06-02) — forensic proof: [`audits/phase-2-zero-debt-forensic-audit-2026-06-02.md`](audits/phase-2-zero-debt-forensic-audit-2026-06-02.md) · gate: `pnpm run phase-2:gate`  
> **راهنمای کامل:** [`phase-2-design-system.md`](phase-2-design-system.md) — زیرفاز 2.1–2.5، معماری tenant×workspace×platform theme، port map از legacy  
> **Hardening:** Closure requires [§12.2](#۱۲۲-verification-as-code) Verification table — not grep-only theme claims.

**هدف:** پایهٔ visual enterprise قبل از wizard واقعی.

| # | کار | Exit |
|---|-----|------|
| 2.1 | `packages/design-tokens` — primitives + semantics | CSS vars export |
| 2.2 | `WorkspaceThemeContract` در SDK + theme ingress (§8.2.1) | type + ingress tests · `workspaceThemePresets` frozen (`Object.freeze`) |
| 2.3 | `packages/ui-primitives` — Button, Input, FieldShell, Alert, Badge | فقط semantic tokens · `forwardRef` · subpath exports |
| 2.4 | `@app-tour/theme-react` + provider chain (harness) | cascade light/dark + `--ws-*` |
| 2.5 | Storybook/playground + `phase-2:guard` | visual sanity + CI |

**`@app-tour/ui-primitives` — inventory (فاز ۲ vs ۳):**

| Component | فاز | Import (subpath) |
|-----------|-----|------------------|
| Button | ۲ ✅ | `@app-tour/ui-primitives/button` |
| Input | ۲ ✅ | `@app-tour/ui-primitives/input` |
| FieldShell | ۲ ✅ | `@app-tour/ui-primitives/field-shell` |
| Alert | ۲ ✅ | `@app-tour/ui-primitives/alert` |
| Badge | ۲ ✅ | `@app-tour/ui-primitives/badge` |
| **Select** | **۳ — Backlog** | Deferred to Phase 3 — **not Complete** |
| **Checkbox** | **۳ — Backlog** | Deferred to Phase 3 — **not Complete** |

Barrel `@app-tour/ui-primitives` is **deprecated** (not in `exports`). Apps must use subpaths; enforced by `pnpm run guard:import-boundary` and `pnpm run audit-boundary`.

**Phase 2 Security Seal:** ✅ **Verified Remediated** — artifact allowlist (`guard:artifact-surface`), CSS token purity, AST barrel ban; fix ref: `e8fc3a8`+ (zero-debt remediation). See [Security & Compliance](#security--compliance) · [Audit & Remediation History](#audit--remediation-history).

**Enforcement (§12):**

| Rule | Phase 2 obligation | Verification command |
|------|-------------------|----------------------|
| **R2** Verification-as-Code | Theme ingress / export claims map to named specs in phase doc **Verification** block | `packages/theme-react` ingress specs · `pnpm run phase-2:gate` · [`audits/phase-2-zero-debt-forensic-audit-2026-06-02.md`](audits/phase-2-zero-debt-forensic-audit-2026-06-02.md) |

> **Phase 3 gate:** **Phase 2.5 (`phase-2:gate`) is an absolute prerequisite.** Do not start Phase 3 app work until `pnpm run phase-2:gate` is green on `main`.

---

### فاز ۳ — Starter workspace + apps minimal — **Scaffold (red-flag backlog active)**

> **Status:** **Scaffold** — not eligible for “Zero-Debt Verified” until [§12](#۱۲-the-zero-debt-covenant-mandatory-enforcement) **R4 + R3 + R5** Runtime Proof + [`backlog/phase-3.2-red-flag-backlog.md`](backlog/phase-3.2-red-flag-backlog.md) exit. Forensic debt: [`audit-red-flags-phase-3.md`](../audit-red-flags-phase-3.md).  
> **Hardening filter:** No phase closure while any §12 claim remains **Aspirational** (no named test/guard).  
> **راهنمای اجرایی:** [`phase-3-design-system.md`](phase-3-design-system.md) — DAG 3.0–3.5، **PHASE 3 ENFORCEMENT**، بدهی فاز ۲ → Invariant · **Hardening:** [§12](#۱۲-the-zero-debt-covenant-mandatory-enforcement) R4 + R3 + R5 until backlog exit

**هدف:** اثبات end-to-end plugin (قبل از Denali) با **access control و DB guardrails** قبل از هر مسیر production.

| # | کار | Exit |
|---|-----|------|
| 3.0 | **Infrastructure & Access Control (CASL)** — `ability.ts` + ingress handoff + Prisma `accessibleBy` | [Phase 3: Infrastructure & Access Control](#phase-3-infrastructure--access-control) · unit + integration tests |
| **3.0-doc** | **Docs-as-Code scaffold** — Markdoc init + `doc-gate` green | [`§26 Doc-Gate`](#۲۶-documentation-governance--dod) · `pnpm run doc-gate` · **required before 3.1 code merge** |
| 3.1 | `packages/workspaces/starter` — plugin کامل + theme | implements contract · theme فقط پس از `ability.can('access', 'WorkspaceTheme')` · **blocked until 3.0-doc passes** |
| 3.2 | `apps/api` — health + `POST /tours` + **Postgres dev** | integration test روی DB واقعی · queries با `accessibleBy` ([§5](#۵-infrastructure--سرویس‌های-واقعی-per-phase)) |
| 3.3 | `apps/web` — shell + ThemeProvider + wizard host | **Scaffolded** (`@apps/web`) · import-boundary on `predev`/`prebuild`/`prelint` · Playwright: create tour · denied theme بدون CASL |
| 3.4 | state: **فقط canonical** | ممنوع dual-write |
| 3.5 | structured logging + health endpoint | [§10](#۱۰-observability--audit) |

> **Postgres در ۳ vs RLS در ۴:** فاز ۳ می‌تواند با DB dev و single-tenant / `tenant_id` ثابت شروع کند؛ **RLS اجباری از فاز ۴** ([§7](#۷-tenant-isolation--poolhybridrouting)). **CASL در ۳** جلوی leakage در application layer را می‌گیرد حتی قبل از RLS کامل.

**Enforcement (§12):**

| Rule | Phase 3 obligation | Verification command |
|------|-------------------|----------------------|
| **R4** Fail-Closed Identity | Dev bearer / web session only when `NODE_ENV === "development"` + explicit env flags | `apps/api/test/tenant-security.spec.ts` · `apps/web/test/is-dev-web-session.spec.ts` |
| **R3** Scale-Invariant Guard | `CanonicalTourService` documents O(1) write path — no post-write full scan | `apps/api/test/canonical-tour-service.spec.ts` (`writeTour-no-full-scan`) |
| **R5** Lessons — Synthetic Integrity | No tautology tests (`legacyRecords === []` as sole proof); require HTTP/runtime flows | [`backlog/phase-3.2-red-flag-backlog.md`](backlog/phase-3.2-red-flag-backlog.md) · `pnpm run phase-3:gate` (when closed) |

#### Phase 3: Infrastructure & Access Control

فاز ۳ فقط «ویزارد + API» نیست — **authority layer** باید هم‌زمان با starter workspace وارد شود. مرجع اجرایی تکمیلی: [`phase-2-design-system.md` §15](phase-2-design-system.md#15-phase-3-infrastructure--access-control).

##### Authorization Policy

- **همهٔ قوانین RBAC/ABAC** برای Workspaceها، Tenantها، و Pluginها باید از طریق **تعاریف declarative CASL** در `@app-tour/workspace-sdk` مدیریت شوند — نه شاخه‌های procedural `if (role === …)` در `apps/api`، `apps/web`، یا renderer.
- `platform-core` **نباید** قوانین tenant/workspace access را hard-code کند؛ engine فقط `RenderPlan` تولید می‌کند؛ **allow/deny** در لایهٔ shell + API با CASL.
- تغییر policy = تغییر `ability.ts` (+ تست‌های ability) — نه پراکندگی در controllerها.

##### CASL Integration

| Item | Requirement |
|------|-------------|
| **Central authority** | `packages/workspace-sdk/src/auth/ability.ts` (export از `@app-tour/workspace-sdk`) — **تنها** منبع حقیقت ability برای کل monorepo در فاز ۳ |
| **Entities** | Ability rules برای **`Workspace`**, **`Tenant`**, **`Plugin`** (و زیرنوع‌های لازم: e.g. `WorkspaceTheme`, `CanonicalDocument`) |
| **Factory** | `defineAbilityFor(user, tenantContext)` (نام نهایی در PR) — pure function، بدون React/Prisma |
| **Consumers** | `apps/api` (route guards)، `apps/web` (server components / loaders)، `@app-tour/theme-react` (قبل از ingress) |

```typescript
// هدف شکل — فاز ۳.0 (نه implement در فاز ۲)
// packages/workspace-sdk/src/auth/ability.ts
import { AbilityBuilder, createMongoAbility } from "@casl/ability";

export type AppAbility = ReturnType<typeof defineAbilityFor>;

export function defineAbilityFor(context: TenantAuthContext) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);
  // declarative rules: Workspace, Tenant, Plugin, WorkspaceTheme, …
  return build();
}
```

**وابستگی:** `@casl/ability` (و در API `@casl/prisma` برای `accessibleBy`) — فقط در لایه‌های مجاز per [§2 import law](#قانون-import-ci-blocking); `workspace-sdk` types + pure ability؛ `apps/api` prisma adapter.

##### Cross-Layer Security (CASL × Theme Ingress Guard)

فاز ۲ **Theme Ingress Guard** (`validateWorkspaceThemeIngress`, `snapshotWorkspaceTheme`, sealed DOM builders) فقط **صحت payload** را تضمین می‌کند — **نه** اینکه actor مجاز به دیدن theme باشد.

**Handoff اجباری (ترتیب غیرقابل تعویض):**

```text
1. Resolve actor + tenant context (apps/web | apps/api)
2. ability.can('access', workspaceThemeSubject)   ← CASL (فاز ۳)
3. validateWorkspaceThemeIngress(plugin, theme)     ← Theme Ingress Guard (فاز ۲)
4. snapshotWorkspaceTheme → WorkspaceThemeProvider → DOM
```

| Layer | Responsibility |
|-------|----------------|
| **CASL** | Authorization — *who* may load workspace brand tokens |
| **Theme Ingress Guard** | Validation — *what* CSS is safe if loaded |

**الزام `@app-tour/theme-react`:** `WorkspaceThemeProvider` (و هر wrapper production مثل `ThemeProviderChain`) **باید** قبل از فراخوانی ingress guard، `ability.can('access', 'WorkspaceTheme')` (یا subject typed معادل) را **pass** کند. در صورت deny: **هیچ** `style` از `theme.cssVariables` به DOM تزریق نشود (fail closed — render children بدون workspace scope یا error boundary ثابت).

```typescript
// هدف — apps/web shell (فاز ۳.3)
if (!ability.can("access", subject("WorkspaceTheme", { workspaceId, pluginId }))) {
  return <WorkspaceThemeDenied />; // or children without workspace theme wrapper
}
return (
  <WorkspaceThemeProvider plugin={plugin} theme={theme} abilityVerified />
);
```

Ingress بدون CASL = **نقض معماری فاز ۳** (همانند فراخوانی `workspaceThemeToStyle` بدون seal).

##### Database Guardrails

از فاز ۳ به بعد، **هر** query Prisma/DB که ردیف‌های tenant/workspace/plugin را برمی‌گرداند یا mutate می‌کند باید با فیلتر **`accessibleBy(ability, 'EntityName')`** (یا معادل `@casl/prisma`) محدود شود تا **horizontal data leakage** (tenant A خواندن tourهای tenant B) در application layer بسته شود.

| Rule | Detail |
|------|--------|
| **Mandatory** | List/read/update/delete روی `Tour`, `Workspace`, `PluginInstall`, … — `where: accessibleBy(ability).Entity` |
| **Forbidden** | Raw `findMany({})` بدون CASL scope در route handlers |
| **Tests** | Integration test: user tenant A cannot `findFirst` رکورد tenant B حتی با UUID حدس‌زده |
| **RLS** | مکمل CASL در فاز ۴ — نه جایگزین در فاز ۳ |

##### Exit criteria 3.0 (CASL)

- [x] `ability.ts` در `workspace-sdk` با rules برای Workspace / Tenant / Plugin / WorkspaceTheme / CanonicalDocument
- [x] Unit tests: allow/deny matrix per role + tenant boundary (15 tests — `ability.spec.ts`; Workspace/Plugin cross-tenant, `owner`)
- [x] `WorkspaceThemeProvider` enforces `access` قبل از ingress (test در `@app-tour/theme-react` — cross-tenant deny)
- [ ] `apps/api` نمونهٔ `POST /tours` + `findMany` با `accessibleBy` — **فاز 3.2**
- [x] Doc: procedural role `if` فقط در `ability.ts` (not in theme-react / apps scaffold for 3.0 scope)

---


### فاز ۴ — Tenant kernel — **Hardened (§12 mandatory)**

> **Hardening filter:** Phase 4+ gates **must** satisfy [§12](#۱۲-the-zero-debt-covenant-mandatory-enforcement) verbatim rules. Grep-only or file-presence checks **cannot** close this phase.

**هدف:** multi-tenant enterprise.

| # | کار | Exit |
|---|-----|------|
| 4.1 | `packages/tenant-kernel` — host resolution, context, **route interface** | unit tests · [§7](#۷-tenant-isolation--poolhybridrouting) |
| 4.2 | Postgres + Redis (Docker) + RLS | isolation e2e |
| 4.3 | provision tenant → default `workspace_type` | دو tenant جدا |
| 4.4 | tenant-level theme hook (لوگو / accent) | web e2e |
| 4.5 | in-process event bus scaffold | [§6](#۶-ارتباط-بین-ماژول‌ها--event-bus--outbox) |

**Enforcement (§12):**

| Rule | Phase 4 obligation | Verification command |
|------|-------------------|----------------------|
| **R4** Fail-Closed Identity | All auth/tenant kernels default **403**; dev-defaults only inside `if (process.env.NODE_ENV === "development")` | `tenant-kernel` contract specs · Testcontainers RLS e2e · **no** production deploy if dev-default paths compile without env gate |

**Gate Compliance Checklist (§12 — mandatory before Phase 4 closure):**

- [ ] **Contractual Gate:** No grep/regex **required** check for Phase 4; must implement `phase-4.contract.spec.ts` (or `packages/tenant-kernel/test/*.contract.spec.ts`) paired with depcruise/HTTP proofs.
- [ ] **Data Integrity:** Adversarial test flow for **P0/P1** breaches in [`audit-red-flags-phase-3.md`](../audit-red-flags-phase-3.md) (dev bearer, in-memory SoT, cross-tenant) and [§13](#۱۳-architecture-breaking-points).
- [ ] **Complexity Bound:** Big-O bounds documented for every new service/repository **before** merge; gate fails on **O(N)** hot paths ([§12.3](#۱۲۳-scale-invariant-guard)).

**Forensic Audit checkpoint (mandatory — [§16](#۱۶-forensic-drift-enforcement)):**

| Item | Placeholder |
|------|-------------|
| **Report** | `reports/phase-4-forensic-audit-YYYY-MM-DD.md` (or `phase-4-clean-code-audit.md`) — Liar's Protocol + Gate Drift + structural lens |
| **Contract** | `packages/tenant-kernel/test/phase-4.contract.spec.ts` — required per [§15](#۱۵-the-phase-gate-constitution) |
| **Purity Score** | Integration path score **≥ 8** before **Complete** / **Closed** |
| **Simplicity** | New abstractions carry **Simplicity Proof** ([§17](#۱۷-the-simplicity-hedge)); Complexity Trap rows remediated or waived |
| **Doc truth** | Phase 4 guide **Verification** table = CI 1:1 ([§18](#۱۸-documentation-truth)) |

**مرجع:** `legacy/apps/api/` — الگو فقط، copy ن selective.

---

### فاز ۵ — Data layer استاندارد — **Hardened (§12 mandatory)**

> **Hardening filter:** Postgres SoT + outbox require **DB Runtime Proof** — not schema file presence alone.

| # | کار | Exit |
|---|-----|------|
| 5.1 | schema: `workspace_type`, `canonical_data` JSONB | migration |
| 5.2 | validate via plugin قبل از persist | API test |
| 5.3 | projected columns برای list/filter (derive از canonical) | query test |
| 5.4 | transactional outbox table + one domain event | [§6](#۶-ارتباط-بین-ماژول‌ها--event-bus--outbox) |
| 5.5 | audit_events table (minimal) | [§10](#۱۰-observability--audit) |

**Enforcement (§12):**

| Rule | Phase 5 obligation | Verification command |
|------|-------------------|----------------------|
| **R3** Scale-Invariant Guard | Every `CanonicalService` / repository adapter documents Big-O; list/filter paths **O(log N)** or indexed | Repository contract specs + query integration on real Postgres |

**Gate Compliance Checklist (§12 — mandatory before Phase 5 closure):**

- [ ] **Contractual Gate:** No grep/regex **required** check for Phase 5; must implement `phase-5.contract.spec.ts` (outbox + repository boundaries).
- [ ] **Data Integrity:** Adversarial tests for P0/P1 storage breaches (full-scan writes, empty legacy mirror, tautology validators) — [§12.8](#۱۲۸-lessons-learned-appendix--phase-3-forensic-detail) · [§13](#۱۳-architecture-breaking-points).
- [ ] **Complexity Bound:** Every `CanonicalService` / outbox handler has documented Big-O; **O(N)** list-after-write paths block closure.

**Forensic Audit checkpoint (mandatory — [§16](#۱۶-forensic-drift-enforcement)):**

| Item | Placeholder |
|------|-------------|
| **Report** | `reports/phase-5-forensic-audit-YYYY-MM-DD.md` |
| **Contract** | `packages/<data-layer>/test/phase-5.contract.spec.ts` |
| **Purity Score** | **≥ 8** on Postgres/outbox integration path |
| **Simplicity / Doc truth** | [§17](#۱۷-the-simplicity-hedge) · [§18](#۱۸-documentation-truth) |

---

### فاز ۶ — Denali workspace (اولین workspace محصول) — **Hardened (§12 mandatory)**

> **Hardening filter:** Denali port claims require plugin **Verification** table + HTTP e2e — not “build green” alone.

**هدف:** port کامل از legacy **داخل plugin** — صفر PR در platform-core.

| # | کار | Exit |
|---|-----|------|
| 6.1 | `packages/workspaces/denali` shell + `denaliPlugin` | build · [§8](#۸-plugin-lifecycle--versioning) |
| 6.2 | port registry/rules از `legacy/packages/denali-domain/` | unit tests |
| 6.3 | port widgets + `theme/tokens.css` | renderer از platform-core |
| 6.4 | finance slice (hooks / policies) در plugin boundary | parity finance · via event bus |
| 6.5 | bootstrap در api/web — lazy load plugin | [§9](#۹-مدل-اعتماد-plugin--first-party-vs-third-party) |
| 6.6 | smoke parity | سناریوهای legacy smoke |
| 6.7 | MinIO + photo upload e2e | [§5](#۵-infrastructure--سرویس‌های-واقعی-per-phase) |
| 6.8 | `migrateCanonical` for legacy trip_details | schemaVersion path |

**ممنوع:** `DENALI_*` constants در `apps/api` core · strip functions در generic DTO layer.

**Enforcement (§12):**

| Rule | Phase 6 obligation | Verification command |
|------|-------------------|----------------------|
| **R2** Verification-as-Code | Every Denali capability claim in `phase-6` doc has **Verification Command** + named test | Plugin contract specs · smoke e2e · `pnpm run phase-6:gate` (when defined) |

**Gate Compliance Checklist (§12 — mandatory before Phase 6 closure):**

- [ ] **Contractual Gate:** No grep/regex **required** check for Phase 6; must implement `phase-6.contract.spec.ts` + `packages/workspaces/denali/test/*.contract.spec.ts`.
- [ ] **Data Integrity:** Adversarial + HTTP e2e for plugin registry, canonical persist, and tenant boundary — not smoke-only compile.
- [ ] **Complexity Bound:** Denali finance/list paths document Big-O before merge; indexed projections only on hot paths.

**Forensic Audit checkpoint (mandatory — [§16](#۱۶-forensic-drift-enforcement)):**

| Item | Placeholder |
|------|-------------|
| **Report** | `reports/phase-6-forensic-audit-YYYY-MM-DD.md` |
| **Contract** | `packages/workspaces/denali/test/phase-6.contract.spec.ts` (+ plugin contract specs) |
| **Purity Score** | **≥ 8** on Denali HTTP/smoke integration path |
| **Simplicity / Doc truth** | [§17](#۱۷-the-simplicity-hedge) · [§18](#۱۸-documentation-truth) |

---

### فاز ۷ — Workspace دوم + hardening — **Hardened (§12 mandatory)**

> **Hardening filter:** Platform DoD requires **all five** §12 rules on the closure checklist — no exceptions.

| # | کار | Exit |
|---|-----|------|
| 7.1 | `packages/workspaces/urban` (minimal) | E2E create → publish |
| 7.2 | ثابت: urban بدون تغییر `platform-core` | guard + diff |
| 7.3 | observability کامل + rate limits + runbook | [§10](#۱۰-observability--audit) |
| 7.4 | `TenantConnectionRouter` enterprise tier (design → impl) | [§7.2](#۷۲-hybrid-tier-فاز-۷--enterprise-contract) |

**Enforcement (§12):**

| Rule | Phase 7 obligation | Verification command |
|------|-------------------|----------------------|
| **R1–R5** Full covenant | Second workspace proves rules are generic — not Denali-specific grep theater | `pnpm run ci:integrity` · Phase Gate Audit Table row **7** populated with Runtime Proof paths |

**Gate Compliance Checklist (§12 — mandatory before Phase 7 / platform DoD closure):**

- [ ] **Contractual Gate:** No grep/regex **required** check for Phase 7; must implement `phase-7.contract.spec.ts` proving second workspace without `platform-core` diff.
- [ ] **Data Integrity:** Full P0/P1 adversarial matrix from Phases 3–6 re-run on Postgres/RLS production paths — [§13](#۱۳-architecture-breaking-points).
- [ ] **Complexity Bound:** Platform DoD checklist includes Big-O attestation for **all** services in [§22](#۲۲-definition-of-done--کل-پلتفرم).

**Forensic Audit checkpoint (mandatory — [§16](#۱۶-forensic-drift-enforcement)):**

| Item | Placeholder |
|------|-------------|
| **Report** | `reports/phase-7-forensic-audit-YYYY-MM-DD.md` · platform-wide `total-paranoid-audit-YYYY-MM-DD.md` before platform DoD |
| **Contract** | `phase-7.contract.spec.ts` — second workspace without `platform-core` diff |
| **Purity Score** | **≥ 8** on full `ci:integrity` / multi-workspace path |
| **Simplicity / Doc truth** | [§17](#۱۷-the-simplicity-hedge) · [§18](#۱۸-documentation-truth) · [§22](#۲۲-definition-of-done--کل-پلتفرم) checklist |

**Definition of Done پلتفرم:** workspace جدید = plugin + theme + bootstrap — **بدون touch core**.

---

## ۱۲. The Zero-Debt Covenant (Mandatory Enforcement)

> **Hardened Compliance Contract:** This MAP is subordinate to §12. No phase narrative, DoD checkbox, or CI green status overrides **R1–R5**.  
> **Authority:** Absolute source of truth for **all** `phase-N:gate` / `phase-N:foundation-gate` definitions, pre-commit hooks, and remediation on Phases 0–7.  
> **Agent / engineer rule:** Read §12 **before** starting work. Violations → **halt**, cite **R1–R5** or [§13](#۱۳-architecture-breaking-points), obtain explicit human approval.

### §12 Protocol — Hardened Compliance Contract

The **Zero-Debt Covenant** enforces four non-negotiable properties on every phase gate:

| Property | Rule ID | Requirement |
|----------|---------|-------------|
| **Grep-free** | **R1** | No required CI check may use grep, regex, or file-presence alone; constraints need `*.contract.spec.ts` and/or depcruise **paired** with a failing behavioral test. |
| **Verified** | **R2** | Every doc claim maps to a named spec or guard; unmapped claims are **Aspirational** and cannot close a gate ([`phase-0-foundation.mdoc`](phase-0-foundation.mdoc) · [§18](#۱۸-documentation-truth) · [§26](#۲۶-documentation-governance--dod)). |
| **Scale-invariant** | **R3** | New services document Big-O before merge; **O(N)** on hot paths blocks phase advance. |
| **Fail-closed** | **R4** | Auth/tenant kernels default **403**; dev shortcuts only under explicit `NODE_ENV === "development"` (+ documented env flags). |

**Lessons registry:** **R5** + forensic detail in [§13 Architecture Breaking Points](#۱۳-architecture-breaking-points) and [§12.5](#۱۲۵-lessons-learned-anti-pattern-registry).

**Phases 4–7:** Each phase in [§11](#۱۱-فازبندی-migration) includes a **Gate Compliance Checklist** (contract spec · adversarial P0/P1 · complexity bound) — all boxes must be checked before closure. **Phase completion law:** [§14.1](#۱۴۱-phase-completion-law-mandatory) · [**Paranoid Audit**](#paranoid-audit-definition).

### Rule index (enforcement IDs)

| ID | Name | §12 subsection |
|----|------|----------------|
| **R1** | Grep-Free Gates | [§12.1](#۱۲۱-grep-free-gates) |
| **R2** | Verification-as-Code | [§12.2](#۱۲۲-verification-as-code) |
| **R3** | Scale-Invariant Guard | [§12.3](#۱۲۳-scale-invariant-guard) |
| **R4** | Fail-Closed Identity | [§12.4](#۱۲۴-fail-closed-identity) |
| **R5** | Lessons Learned (Anti-Pattern Registry) | [§12.5](#۱۲۵-lessons-learned-anti-pattern-registry) |

Each phase row in [§11](#۱۱-فازبندی-migration) includes an **Enforcement (§12)** table referencing at least one rule.

---

### ۱۲.۱ Grep-Free Gates

**Grep-Free Gates:** No CI gate is allowed to rely on grep, regex, or file-presence alone. Every architectural constraint (like `no-legacy-imports`) **MUST** be validated via runtime `contract.spec.ts` or depcruise dependency-graph analysis **paired with** a behavioral test that fails when the constraint is violated.

| Proof class | When to use | Example |
|-------------|-------------|---------|
| **`*.contract.spec.ts`** | Package boundary, export surface, ingress/seal invariants | Theme ingress cannot bypass `validateWorkspaceThemeIngress` |
| **depcruise + paired spec** | Import law (`no-legacy-imports`, workspace boundaries) | `guard:architecture` **and** adversarial / integration spec |
| **HTTP / integration test** | API auth, tenant isolation, persistence, web→API bridge | `POST /tours` with forbidden bearer → `401` |
| **DB / Testcontainers test** | RLS, outbox, Postgres SoT (Phase 5+) | Cross-tenant read returns `403`/`404` on real DB |

**Transitional (Phases 0–3):** Existing `rg` / `phase-N-guard.mjs` grep checks may remain **supplementary only**. They **must not** be the sole reason a phase is marked **Closed** or **Zero-Debt Verified**.

**Phase 4+ gate script rule:** New **required** checks in `phase-N-guard.mjs` must invoke test runners or HTTP listeners — not add grep-only required checks.

---

### ۱۲.۲ Verification-as-Code

**Verification-as-Code:** Every document header in `docs/` must list the **Verification Command** that proves the claim. If a claim (e.g. “no UI in foundation”) has no corresponding test in `scripts/guards/` or a named `*.spec.ts` / `*.contract.spec.ts`, it is legally **Aspirational** and **forbidden** from passing Phase gates.

#### Mandatory doc block

```markdown
## Verification

| Claim | Runtime proof | Verification command |
|-------|----------------|----------------------|
| … | `path/to/*.contract.spec.ts` or integration spec | `pnpm …` |
```

| Label | Meaning | Gate impact |
|-------|---------|-------------|
| **Aspirational** | Claim in doc with no guard/test mapping | **Cannot** pass phase gate |
| **Scaffold-Only** | Code path exists for compile/UX; not production-safe | Gate **cannot** close until Runtime Proof exists |
| **Verified Remediated** | Forensic audit + runtime tests + gate log in same PR | Allowed for phase closure |

**Forbidden without Runtime Proof table:** **“Fully satisfied”**, **“Zero-Debt Verified”**, **“production-perfect”**, **“Security Seal: green”**.

**Doc-Gate:** [`§26`](#۲۶-documentation-governance--dod) · `pnpm run guard:doc-sync` · Verification 1:1 per [§18](#۱۸-documentation-truth).

---

### ۱۲.۳ Scale-Invariant Guard

**Scale-Invariant Guard:** Any `CanonicalService` must document its **Big-O performance bound**. Any **O(N)** operation in a high-traffic path is **blocked** from moving to the next Phase until optimized to **O(1)** or **O(log N)**.

| Bound | Requirement | Phase gate |
|-------|-------------|------------|
| **O(1)** or **O(log N)** per request | Indexed by `id` and/or `tenantId`; no full-table scan on write path | **Required** for Phase 4+ closure |
| **O(global N)** | e.g. post-write `findMany` over all rows | **Broken/Draft** — gate **must fail** |

**Regression:** `writeTour-no-full-scan` or equivalent HTTP proof ([`audit-red-flags-phase-3.md` §4](../audit-red-flags-phase-3.md)).

---

### ۱۲.۴ Fail-Closed Identity

**Fail-Closed Identity:** All auth/tenant kernels must default to **403 (Fail-Closed)**. **Dev-defaults** are only allowed inside `if (process.env.NODE_ENV === "development")` (plus explicit env flags in `.env.example`). **No production deployment** is permitted if dev-default paths are reachable without that condition.

1. Missing/invalid credentials → `401` / `403` / `UNAUTHORIZED_*` / `FORBIDDEN_*` — no fabricated admin tenant.
2. Web session resolved **per HTTP request** on the server — never at module import in client bundles.
3. In-memory global stores for canonical data = **Scaffold-Only** until Postgres SoT (Phase 4+).

---

### ۱۲.۵ Lessons Learned (Anti-Pattern Registry)

**Canonical registry:** [§13 Architecture Breaking Points](#۱۳-architecture-breaking-points). Summary:

- **[!] Scaffold Theater** — Foundation-labeled packages must contain **zero** production/app logic (RF-P0-ABS-01).
- **[!] Gate Drift** — CI gates run on **phase targets**, not the full monorepo (RF-P0-GATE-01 · KS-01).
- **[!] Isolation Leak** — Packages importing `react` or Nest must be **Feature-Layer** and **fail** `phase-0:foundation-gate` (RF-P0-ABS-04/05).
- **[!] Synthetic Integrity** — Tautology unit tests forbidden; runtime integration required.

**Forensic baselines:** [`audits/phase-0-forensic-audit.md`](../audits/phase-0-forensic-audit.md) · [`audit-red-flags-phase-0.md`](../audit-red-flags-phase-0.md) · [`audit-red-flags-phase-3.md`](../audit-red-flags-phase-3.md) · [`audits/phase-2-zero-debt-forensic-audit-2026-06-02.md`](audits/phase-2-zero-debt-forensic-audit-2026-06-02.md).

#### Gate theater — demote or pair (Phase 4+)

| ID | Misleading green | Required action |
|----|------------------|-----------------|
| RF-G01 | `canonical-integrity.spec.ts` (grep only) | HTTP SoT test |
| RF-G02 | `canonical-sot.spec.ts` (substring ban) | API bridge integration |
| RF-G07 | cross-tenant on in-memory store only | Testcontainers + RLS |
| RF-G09 | test count floors without behavior | Review for tautologies |

---

### ۱۲.۶ Phase Gate — Runtime Proof (not Source Proof)

**Definition:** A phase gate (`pnpm run phase-N:gate`) is **green** only when **all** of the following hold:

1. **Build + unit tests** for packages in scope (unchanged baseline).
2. **Runtime Proof suite** for that phase’s claims (contract + integration tests listed in the phase doc **Verification** section) — exit code 0.
3. **No Broken/Draft** services or identity paths on the closure checklist.
4. **Phase Gate Audit Table** row updated with **Runtime Proof** column populated (test paths, not “grep green”).
5. Archived forensic audit under [`docs/audits/`](audits/README.md) when closing or re-opening a phase.

**Explicitly not sufficient for closure:**

- dependency-cruiser alone,
- `rg -i denali` / legacy substring guards alone,
- dist/file-count guards without consumer contract tests,
- test **count floors** without behavioral coverage review ([`audit-red-flags-phase-3.md` RF-G09](../audit-red-flags-phase-3.md)).

**Phase 4+ gate script rule:** New checks in `phase-N-guard.mjs` must invoke **test runners** or **HTTP listeners** (`createRequestListener`, Playwright, Testcontainers) — not add new grep-only required checks.

---

### Phase Gate Audit Table — Runtime Proof required

**Maintenance:** Add or update a row when a phase starts, passes gate, or forensic audit lands. **Do not delete rows.** Phase 3 row reflects scaffold honesty until 3.2 backlog exits.

| Phase | Security / honesty status | Runtime Proof (mandatory evidence) | Dist/ leakage | CSS literal debt | Barrel violations |
|-------|---------------------------|-------------------------------------|---------------|------------------|-------------------|
| **0** — Foundation | KS-01 split (foundation contract-only) | [Verifies: `packages/workspace-sdk/test/phase-0.contract.spec.ts`](../packages/workspace-sdk/test/phase-0.contract.spec.ts) · `pnpm run test:phase-0` · CI job **Phase 0 closure contract** · integration: `phase-0:integration-gate` | 0 | N/A | 0 |
| **1** — Platform core | Closed (baseline) | `platform-wizard.engine` specs + adversarial validation | 0 | N/A | 0 |
| **2** — Design system | **Verified Remediated** | `theme-react` ingress specs + `guard:artifact-surface` + [forensic 2026-06-02](audits/phase-2-zero-debt-forensic-audit-2026-06-02.md) | 0 | 0 | 0 |
| **2.5** — Gate | `phase-2:gate` | Same as Phase 2 | 0 | 0 | 0 |
| **3** — Starter + apps | **Scaffold — red-flag backlog active** | **Not closed** until: dev bearer gated, per-request web session, indexed store, web `POST /tours` integration — see [`backlog/phase-3.2-red-flag-backlog.md`](backlog/phase-3.2-red-flag-backlog.md) · [`audit-red-flags-phase-3.md`](../audit-red-flags-phase-3.md) | per Phase 2 for publish pkgs | 0 in primitives | 0 |
| **4** — Tenant / RLS | ⏸ Not started | **Required:** JWT/host session contract tests; no dev bearer in prod; Postgres + RLS integration | — | — | — |
| **5** — Events / outbox | ⏸ Not started | **Required:** outbox idempotency integration test (real DB) | — | — | — |
| **6** — Denali workspace | ⏸ Not started | **Required:** plugin registry HTTP + canonical persist e2e | — | — | — |
| **7** — Hardening / DoD | ⏸ Not started | Full [§22](#۲۲-definition-of-done--کل-پلتفرم) DoD checklist with runtime suites | — | — | — |

**Column: Runtime Proof** — Comma-separated test paths or CI job names; empty means **not eligible for closure**.

---

### ۱۲.۷ Carried forward — export & artifact safety (Phase 2+)

These rules remain in force (formerly scattered in phase-2 protocol):

| # | Rule | Runtime / guard proof |
|---|------|------------------------|
| **E1** | No public export bypassing theme ingress / sealing / `assertThemeCssValueIsSafe` | `theme-ingress-guard.spec.tsx` · `guard:artifact-surface` |
| **E2** | Guard-first: `exports` + `files` allowlist before feature merge | `verify:exports` · `guard:import-boundary` |
| **E3** | Honest reporting only: **Verified Remediated** / **Scaffold-Only** / **Open — SB-xx** | Audit table + archived `.mdoc` |
| **E4** | `dist/` ⊆ `files` ∩ `exports` | `pnpm run guard:artifact-surface` |
| **E5** | Doc-code parity in same PR | `pnpm run guard:doc-sync` · `doc-gate` |

#### Covenant violations — mandatory halt

Stop and warn if a task would: add ui-primitives barrel import; expose theme mapper bypass paths; mark a phase **Closed** without Runtime Proof column; ship O(N) canonical write path; accept dev bearer without env gate; or restore “Zero-Debt Verified” for Phase 3 before backlog exit.

```bash
pnpm run guard:artifact-surface
pnpm run guard:import-boundary
pnpm run audit-boundary
# Phase 4+ add:
pnpm --filter @apps/api test          # must include tenant-security + integration.routes
pnpm --filter @apps/web test          # must include fetch-tour-client / server-action tests
```

---

### ۱۲.۸ Lessons Learned appendix — Phase 3 forensic (detail)

**Source:** [`audit-red-flags-phase-3.md`](../audit-red-flags-phase-3.md) (2026-06-03). **Never repeat** without Runtime Proof in Phase 4+.

#### Auth & identity (P0)

| Lesson | What went wrong | Permanent rule |
|--------|-----------------|----------------|
| **L3-AUTH-01** | API accepted unsigned `Bearer dev.<base64>` with arbitrary tenant/role (`parse-dev-bearer.ts`, bearer before headers) | RF-F09: gate dev bearer + JWT verify; integration test `tenant-security.spec.ts` |
| **L3-AUTH-02** | Web session from `NEXT_PUBLIC_DEV_*` at **module load** — static admin tenant | RF-F05/F06: per-request server session; `ALLOW_DEV_WEB_SESSION` only in development |
| **L3-AUTH-03** | “TenantKernel” on web never called API kernel; two identity stories | Single ingress contract; `TourClient` + server actions for API calls |

#### Storage & canonical (P0–P1)

| Lesson | What went wrong | Permanent rule |
|--------|-----------------|----------------|
| **L3-STORE-01** | `InMemoryTourRepository` global array; data lost on restart | RF-F01: label **Scaffold-Only** until Postgres; no “canonical SoT” marketing |
| **L3-STORE-02** | `writeTour` → `listCanonicalRecords()` full scan every write | RF-SCALE: **Broken/Draft**; indexed store + `writeTour-no-full-scan` test |
| **L3-STORE-03** | `LegacyCanonicalAdapter` empty mirror; sync validator tautology | RF-F02: **Scaffold-Only** until real legacy path or delete name |
| **L3-STORE-04** | API validation hard-wired to `starterWorkspacePlugin` only | RF-F03: plugin resolution from registry/header in Phase 4+ |

#### UI–API disconnect (P1 product)

| Lesson | What went wrong | Permanent rule |
|--------|-----------------|----------------|
| **L3-BRIDGE-01** | Wizard rendered `buildRenderPlan` only; no `POST /tours` from web | RF-F08: **TourClient** / `FetchTourClient` + server action; integration test required |
| **L3-BRIDGE-02** | Two pipelines (web engine vs API validation) with different plugin binding | RF-D01: one persist path; contract tests align payload shape |

#### Gate theater (never again)

| ID | Guard / test | Why green was misleading | Phase 4+ action |
|----|--------------|--------------------------|-----------------|
| RF-G01 | `canonical-integrity.spec.ts` | Grep for `prisma` / `legacy` | Demote; require HTTP SoT test |
| RF-G02 | `apps/web/test/canonical-sot.spec.ts` | Substring ban only | Replace with API bridge integration |
| RF-G03 | `validate-canonical-sync.mjs` | Delegates to empty-legacy unit specs | Require mirror drift test or drop “sync” name |
| RF-G04 | `guard-no-raw-queries.mjs` | Textual `.findById` ban | Pair with repository contract test |
| RF-G07 | `cross-tenant-forensic.spec.ts` on in-memory store | No Postgres/RLS | Testcontainers + RLS in Phase 4 |
| RF-G08 | `phase-3:gate` ⊃ `phase-2:gate` | Design-system green masks API/web gap | Phase 4 gate must include tenant + persist proofs |
| RF-G09 | Test count floors only | Quantity ≠ behavior | Review suite for tautologies |

#### Scale (operational)

| Lesson | Symptom @ load | Rule |
|--------|----------------|------|
| **L3-SCALE-01** | O(global N) filter on every write | Document **Complexity Bound**; fail gate if Broken/Draft |
| **L3-SCALE-02** | Unbounded heap per process | Env caps + `429` tests until Postgres |

---

### ۱۲.۹ Protocol acknowledgment (agents & contributors)

1. **Read** [§12](#۱۲-the-zero-debt-covenant-mandatory-enforcement) before any phase task (and before claiming Phase 3.2 backlog items done).
2. **Run** Runtime Proof suites locally before claiming completion.
3. **Update** the Phase Gate Audit Table in the **same PR** as the fix.
4. **Halt** when a request conflicts with §12 — do not silently compromise.

**Forensic baselines:** Phase 2 — [`audits/phase-2-zero-debt-forensic-audit-2026-06-02.md`](audits/phase-2-zero-debt-forensic-audit-2026-06-02.md) · Phase 3 — [`audit-red-flags-phase-3.md`](../audit-red-flags-phase-3.md) · Phase 0 — [`audit-red-flags-phase-0.md`](../audit-red-flags-phase-0.md) · [`audits/phase-0-forensic-audit.md`](../audits/phase-0-forensic-audit.md).

---

### ۱۲.۱۰ Mandatory Sync — phase-gate guard changes

**Rule:** Any change to a **phase gate** requires **manual Forensic Audit approval** before merge.

**In scope (all require approval):**

- `scripts/guards/phase-N-guard.mjs` (including `phase-0-guard.mjs`, `baseline-metrics.mjs` when wired to foundation gate)
- `phase-N:gate`, `phase-N:foundation-gate`, `phase-N:integration-gate` in root [`package.json`](../package.json)
- `.github/workflows/phase-N-gate.yml` or equivalent CI job definitions
- New **required** grep/regex checks (forbidden under R1 unless demoted to supplementary with paired `*.contract.spec.ts`)

**Approval evidence (PR must include):**

1. Link to relevant forensic audit ([`audits/phase-0-forensic-audit.md`](../audits/phase-0-forensic-audit.md) · `audit-red-flags-phase-N.md` · or new file under [`docs/audits/`](audits/README.md))
2. Updated **Verification** table in the phase doc ([§12.2](#۱۲۲-verification-as-code))
3. Updated row in [Phase Gate Audit Table](#phase-gate-audit-table--runtime-proof-required)
4. Human reviewer sign-off in PR description: `Forensic Audit: approved for gate change`

**Without approval:** gate changes are **covenant violations** — revert or halt per [§12.7](#۱۲۷-carried-forward--export--artifact-safety-phase-2).

---

## ۱۳. Architecture Breaking Points

> **Registry of failures** from Phase 0/3 forensic audits. Every future phase gate and PR must treat these as **blocking anti-patterns** ([§12.5](#۱۲۵-lessons-learned-anti-pattern-registry) · **R5**).

| ID | Breaking point | Rule | Enforcement |
|----|----------------|------|-------------|
| **BP-01** | **[!] Scaffold Theater** | Packages labeled **Foundation** (`workspace-sdk`, `config` in foundation gate) must contain **ZERO** production app logic — no Nest apps, no React UI, no `apps/*` in foundation closure. | `phase-0:foundation-gate` scope · [Verifies: `foundation-gate-config.mjs`](../scripts/guards/foundation-gate-config.mjs) · KS-01 |
| **BP-02** | **[!] Gate Drift** | CI gates must run on **phase targets**, **NOT** the full monorepo, for closure claims. Trunk integration is a **separate** job (`phase-N:integration-gate`). | [Verifies: `.github/workflows/phase-0-gate.yml`](../.github/workflows/phase-0-gate.yml) (foundation vs integration jobs) · [Verifies: `package.json`](../package.json) |
| **BP-03** | **[!] Isolation Leak** | Any package importing **`react`**, **`react-dom`**, or **Nest** (`@nestjs/*`) is **Feature-Layer** (Phase 2–3+). It **must** be excluded from `phase-0:foundation-gate` and **must fail** foundation gate if added to foundation scan roots. | [Verifies: `scripts/guards/phase-0-guard.mjs`](../scripts/guards/phase-0-guard.mjs) (g6 integration scope) · depcruise package rules · `ui-primitives` / `theme-react` / `apps/*` only in integration gate |
| **BP-04** | **[!] Grep-only closure** | `rg` / regex / `fs.existsSync` alone cannot mark a phase **Closed** or **Zero-Debt Verified**. | **R1** · [§14.1](#۱۴۱-phase-completion-law-mandatory) · [Verifies: `*-coupling.contract.spec.ts` / `legacy-import.contract.spec.ts`](../packages/workspace-sdk/test/) |
| **BP-07** | **[!] Forensic Drift** | Weakening guards/tests/thresholds without **`forensic-drift`** label + **Architect** sign-off is a covenant violation. | [§14.3](#۱۴۳-the-forensic-drift-override) · [§12.10](#۱۲۱۰-mandatory-sync--phase-gate-guard-changes) |
| **BP-05** | **[!] Env-Leaking guards** | Guard subprocesses must not inherit full `process.env` (CI secrets → tests). | [Verifies: `scripts/guards/lib/guard-subprocess-env.mjs`](../scripts/guards/lib/guard-subprocess-env.mjs) (P0-ISO-03) |
| **BP-06** | **[!] Import-time global state** | Foundation packages must not freeze singletons on `import` (theme presets, reference plugin). | [Verifies: `packages/workspace-sdk/test/import-purity.spec.ts`](../packages/workspace-sdk/test/import-purity.spec.ts) (KS-13) |

**Sources:** [`audits/phase-0-forensic-audit.md`](../audits/phase-0-forensic-audit.md) · [`audit-red-flags-phase-0.md`](../audit-red-flags-phase-0.md) · [`audit-red-flags-phase-3.md`](../audit-red-flags-phase-3.md).

**Phase 4+ obligation:** New breaking points discovered in audit must be appended to this table in the **same PR** as the fix.

### Paranoid Audit (definition) {#paranoid-audit-definition}

The **Paranoid Audit** is the mandatory forensic protocol referenced by [§14](#۱۴-the-constitution-of-phases). It is **not** a single script — it is the **evidence bar** a phase must meet before closure.

| Step | Requirement |
|------|-------------|
| **1. Liar's Protocol** | Every “Complete” / “Verified” claim in the phase doc is traced to a named `*.contract.spec.ts`, depcruise rule + paired spec, or integration/adversarial test. Unmapped claims stay **Aspirational**. |
| **2. Scaffold Theater scan** | Confirm the phase gate builds/tests **only** its declared package targets (foundation vs integration jobs — **BP-01** · **BP-02** in table above). |
| **3. Gate Drift scan** | Confirm `phase-N:foundation-gate` (if any) does **not** pull in `apps/*`, design-system packages, or full `pnpm build` unless explicitly integration-gate. |
| **4. Contract suite** | `packages/<phase-primary>/test/phase-N.contract.spec.ts` (or `packages/workspace-sdk/test/*-coupling.contract.spec.ts` for Phase 0) is **required** and green in CI. |
| **5. Hard-fix backlog** | Open items from the phase paranoid report (e.g. [`audit-red-flags-phase-0.md`](../audit-red-flags-phase-0.md)) must be **closed or explicitly deferred** with Architect sign-off. |
| **6. Purity Score** | Report **Purity Score (0–10)** for the phase integration path ([§16](#۱۶-forensic-drift-enforcement)). **&lt; 8 blocks closure** unless Architect waiver in the audit artifact. |

**Phase 0 reference implementation:** [`phase-0.contract.spec.ts`](../packages/workspace-sdk/test/phase-0.contract.spec.ts) (aggregator) · `denali-coupling.contract.spec.ts` · `legacy-import.contract.spec.ts` · `contract.spec.ts` · `invariant-manifest.contract.spec.ts` · `foundation-scope-assert.mjs` · KS-01 workflow split.

---

## ۱۴. The Constitution of Phases

> **Constitution Injection (Phase 0 forensic):** Makes future phases immune to **Scaffold Theater** and **Gate Drift**. Subordinate to nothing except explicit **Architect** override on record.

### ۱۴.۱ Phase completion law (mandatory)

**No Phase can be marked “Complete”** (or **Closed**, **Zero-Debt Verified**, **production-perfect**) unless a **`phase-N.contract.spec.ts`** exists per [§15](#۱۵-the-phase-gate-constitution) and passes the [**Paranoid Audit**](#paranoid-audit-definition) ([§13](#۱۳-architecture-breaking-points) · [§16](#۱۶-forensic-drift-enforcement) — **Purity Score ≥ 8**).

Any attempt to bypass this with **grep-only** checks, **count-only** thresholds (e.g. “≥ N tests” without behavioral invariants), or **file-presence** guards alone is a **formal violation** of the [Zero-Debt Covenant (§12)](#۱۲-the-zero-debt-covenant-mandatory-enforcement) — specifically **R1 Grep-Free Gates** and **R2 Verification-as-Code**.

### ۱۴.۲ Gate Hardening Policy (mandatory)

**Every new Phase Gate MUST:**

| # | Requirement | Proof |
|---|-------------|--------|
| **1** | **Isolated scope** — run build/test/guards **only** on that phase’s declared package targets; trunk-wide checks live in a separate **`phase-N:integration-gate`** job. | Scope assert script or workflow step (Phase 0: [`foundation-scope-assert.mjs`](../scripts/guards/foundation-scope-assert.mjs)) |
| **2** | **Adversarial test** — at least one test that **tries to break** the phase’s core abstraction (ingress bypass, cross-tenant leak, import boundary violation, identity fail-open, etc.). | Named `test/adversarial-*.spec.ts` or red-team suite in phase doc |
| **3** | **Verification table** — **1:1 mapping** between doc claims and code enforcements (`### Verification` per [§12.2](#۱۲۲-verification-as-code)); no row → claim is **Aspirational**. | `pnpm run guard:doc-sync` + phase doc audit |

### ۱۴.۳ The Forensic Drift Override

If any engineer (or AI) modifies a **guard script**, **gate workflow**, **contract spec**, or **threshold** in a way that **simplifies a failure** (examples: strict test → warning; shrinking scan roots; lowering test-count floor; replacing depcruise/contract with `rg`; excluding meta files to hide coupling tokens), the PR **must**:

1. Apply GitHub label **`forensic-drift`** (or equivalent visible flag in PR description: `Forensic-Drift: yes`).
2. Obtain **manual human sign-off from the Architect** before merge — no bot/auto-merge.
3. Update the phase **Verification** table and [§13](#۱۳-architecture-breaking-points) if the change is intentional policy.

**Silent weakening is a covenant violation** — revert or halt per [§12.10](#۱۲۱۰-mandatory-sync--phase-gate-guard-changes).

### ۱۴.۴ Self-Referencing Audit (mandatory phase docs)

Every phase guide under [`docs/`](.) **must** include a mandatory section:

```markdown
## §N.X Forensic Truth vs Marketing
```

That section **objectively lists** every requirement that is currently **Aspirational** (unenforced — no named spec/guard/contract test). It **must not** bury aspirational items inside green checklists.

| Required content | Purpose |
|------------------|---------|
| Table: Claim → Status (**Verified** / **Aspirational** / **Scaffold-Only**) | Prevents **Doc-Code Drift** before closure |
| Link to `phase-N.contract.spec.ts` and adversarial tests | Satisfies Paranoid Audit step 1 |
| Known structural liabilities (RF-P0-style) | Honest integration-foundation narrative |

**Reference:** [`phase-0-foundation.mdoc` — Forensic Truth](phase-0-foundation.mdoc) · [Unenforced Aspiration](phase-0-foundation.mdoc).

**Doc-Gate enforcement:** [§26 Documentation Governance](#۲۶-documentation-governance--dod) · `pnpm run guard:doc-sync` must fail if the section marker is missing for active phases in `docs/phase-registry.json`.

---

## Compliance-by-Design (Governance Architecture)

> **Purpose:** Prevent recurrence of Phase 0 failure modes — **Gate Drift** (foundation job running trunk scope), **Scaffold Theater** (green CI without contract proof), and **grep/substring closure** — across **Phases 1–7**.

This block is **mandatory** for every phase PR, gate script, and phase guide update. It extends [§14](#۱۴-the-constitution-of-phases) with enforceable, auditable rules. When §12, §14, and §15–§18 conflict, the stricter rule wins unless **Architect** records an override in the PR body.

| Phase 0 lesson | Compliance-by-Design response |
|----------------|------------------------------|
| Gate Drift | [§15](#۱۵-the-phase-gate-constitution) + isolated `phase-N:foundation-gate` / `phase-N:integration-gate` |
| Grep / count theater | Contract specs only — [§15](#۱۵-the-phase-gate-constitution) · [§12 R1](#۱۲۱-grep-free-gates) |
| Doc claims without tests | [§18](#۱۸-documentation-truth) · [§12 R2](#۱۲۲-verification-as-code) |
| Over-layered engines | [§17](#۱۷-the-simplicity-hedge) · Forensic Audit **Complexity Trap** row |
| Closure without forensic review | [§16](#۱۶-forensic-drift-enforcement) — **Purity Score** gate |

---

## ۱۵. The Phase Gate Constitution {#۱۵-the-phase-gate-constitution}

> **§15 — Phase Gate Constitution (mandatory for Phases 0–7)**

**No feature may be merged** into a phase closure branch unless a phase-specific **`phase-N.contract.spec.ts`** exists (aggregator or single-file) under the phase’s primary package `test/` tree.

| Rule | Requirement |
|------|-------------|
| **Existence** | `phase-N.contract.spec.ts` (e.g. [`phase-0.contract.spec.ts`](../packages/workspace-sdk/test/phase-0.contract.spec.ts)) **or** documented equivalent aggregator approved by Architect |
| **Proof class** | The spec **must prove architectural integrity** for that phase using **depcruise**, **behavioral/adversarial tests**, and/or **HTTP/DB integration** — **not** `rg`, substring scans, or file-count floors as **required** pass criteria |
| **CI** | `phase-N:gate` (or `phase-N:foundation-gate` where applicable) **must** execute the contract suite green before merge |
| **Grep** | Supplementary `rg` allowed only when paired with a **failing** contract or depcruise test that breaks on violation ([§12.1](#۱۲۱-grep-free-gates)) |

**Violation:** Merging phase scope without `phase-N.contract.spec.ts` → **covenant breach** · PR blocked · label `missing-phase-contract`.

---

## ۱۶. Forensic Drift Enforcement {#۱۶-forensic-drift-enforcement}

> **§16 — Automated forensic bar at phase end**

At the **end of every phase** (before marking **Complete**, **Closed**, or **Zero-Debt Verified**), the team **must** run a [**Forensic Paranoid Audit**](#paranoid-audit-definition) and publish the report under `reports/` (e.g. `total-paranoid-audit-YYYY-MM-DD.md`, `phase-N-clean-code-audit.md`).

| Step | Requirement |
|------|-------------|
| **1. Liar's Protocol** | Doc claims vs filesystem + CI (per phase guide + this MAP) |
| **2. Gate Drift / Scaffold Theater** | Foundation vs integration jobs; build/test scope |
| **3. Structural / clean-code lens** | Side-effect, boundary, abstraction tax (see [`audits/phase-1-documentation-integrity-2026-06-03.mdoc`](audits/phase-1-documentation-integrity-2026-06-03.mdoc)) |
| **4. Purity Score** | Report **Purity Score (0–10)** for the phase integration path |

**Blocking rule:** If **Purity Score &lt; 8**, the phase **is blocked** from closure until remediated or **Architect** signs a time-boxed waiver in the audit report (with named H-series tasks and dates).

**CI recommendation:** Add `phase-N:forensic-audit` script or manual checklist item in phase doc § gate — artifact upload optional.

**Relation to [§14.3](#۱۴۳-the-forensic-drift-override):** §14.3 covers **in-flight** guard weakening; §16 covers **end-of-phase** honesty gate.

---

## ۱۷. The Simplicity Hedge (Anti-Overengineering) {#۱۷-the-simplicity-hedge}

> **§17 — Simplicity Proof required for new abstractions**

**Any new architectural abstraction** introduced in Phases 1–7 — including but not limited to **Factory**, **DI container**, **service locator**, **meta-programming**, **registry of registries**, or **multi-layer facade chains** — **must** include a **Simplicity Proof**:

| Simplicity Proof | Content |
|------------------|---------|
| **Location** | Brief comment adjacent to the abstraction (or ADR link in PR) |
| **Question answered** | Why a **plain function**, **closure**, or **existing engine method** was insufficient |
| **Audit** | Forensic / clean-code audit may classify the pattern as **Complexity Trap** (see [`audits/phase-1-documentation-integrity-2026-06-03.mdoc`](audits/phase-1-documentation-integrity-2026-06-03.mdoc)) |

**If classified Complexity Trap:** Refactor before phase closure — unless Architect documents exception in the phase forensic report.

**Positive examples in repo:** lazy IIFE getters in SDK (`getStarterWorkspacePlugin`) · single facade `PlatformWizardEngine` · no DI framework.

---

## ۱۸. Documentation Truth {#۱۸-documentation-truth}

> **§18 — Verification table must equal CI 1:1**

Each phase guide (`docs/phase-N-*.mdoc` / `.md`) **must** contain a **`### Verification`** table (or **Verification Table**) where **every row** maps a claim to a **real** enforcement path.

| Rule | Requirement |
|------|-------------|
| **1:1** | Each row’s Verification column **must** name an existing `*.contract.spec.ts`, guard script, or CI job step that **actually runs** in `phase-N:gate` |
| **P0 defect** | Listing a check that **does not exist** in CI or code (stale grep id, retired guard, wrong script name) is a **P0 documentation defect** — fix before merge |
| **Drift detection** | `pnpm run guard:doc-sync` + phase forensic audit · optional future: doc-sync parses Verification tables against `package.json` scripts |
| **Marketing** | Unmapped claims belong in **Forensic Truth / Unenforced Aspiration** — not in green checklists ([§14.4](#۱۴۴-self-referencing-audit-mandatory-phase-docs)) |

**Reference:** [`phase-0-foundation.mdoc` — Verification Table](phase-0-foundation.mdoc) · Phase 0 CI [`.github/workflows/phase-0-gate.yml`](../.github/workflows/phase-0-gate.yml).

---

## ۱۹. DAG وابستگی فازها {#۱۹-dag-وابستگی-فازها}

```text
Phase 0 ──→ Phase 1 (platform-core)
                ↓
            Phase 2 (design-tokens + ui-primitives)
                ↓
            Phase 3 (starter + apps)
                ↓
            Phase 4 (tenant) ──→ Phase 5 (data)
                ↓                      ↓
            Phase 6 (denali) ←──────────┘
                ↓
            Phase 7 (workspace #2 + hardening)
```

**Overlap مجاز:** طراحی schema فاز ۵ موازی فاز ۳ (بدون cutover).  
**Overlap ممنوع:** Denali (۶) قبل از starter (۳) · tenant (۴) قبل از apps (۳).

---

## ۲۰. Guardrails (CI) {#۲۰-guardrails-ci}

> **Phase 4+:** Rows marked **grep-only** are **supplementary** only — see [§12.1 Grep-Free Gates](#۱۲۱-grep-free-gates). Phase closure requires **Runtime Proof**.

| Guard | فاز | blocking | Proof class |
|-------|-----|----------|-------------|
| `workspace-sdk` ↛ workspaces | 0+ | ✅ | depcruise + contract |
| `platform-core` ↛ workspaces | 1+ | ✅ | depcruise + engine specs |
| `rg -i denali packages/platform-core packages/workspace-sdk` → 0 | 1+ | ✅ supplementary | **grep-only** |
| no direct `<input>` in `apps/web/.../wizard` shell path | 3+ | ✅ | AST import-boundary |
| workspace static import in shell | 6+ | ✅ | depcruise |
| baseline token count regression | 6+ | 📊 | metrics JSON |
| e2e requires Docker (no skip-as-pass) | 3+ | ✅ | **integration** |
| outbox idempotency test | 5+ | ✅ | **integration (DB)** |
| mandatory `tenant_id` context on every API route (Tenant-Kernel / Host) | 4+ | ✅ critical | **HTTP contract** (`tenant-security.spec.ts`) |
| dev bearer / web dev session gated | 3.2+ | ✅ critical | **HTTP + env** (Phase 3.2 rescue) |
| web wizard → `POST /tours` | 3.2+ | ✅ critical | **integration** (`FetchTourClient` / server action) |
| canonical write path O(1) sync | 3.2+ | ✅ | **unit** `writeTour-no-full-scan` |

**قانون معماری (blocking):** Any endpoint definition without a mandatory tenant context in its middleware is a critical architecture violation.

```bash
pnpm build && pnpm test && pnpm run guard:architecture
```

---

## Security & Compliance

> **مرجع ممیزی:** [`audit-red-flags-phase-0.md`](../audit-red-flags-phase-0.md) · [`audits/phase-2-zero-debt-forensic-audit-2026-06-02.md`](audits/phase-2-zero-debt-forensic-audit-2026-06-02.md) — structural / theme security (malicious tenant admin threat model, exploit vectors, remediation log).  
> **مرجع hygiene (non-blocking backlog):** [`audits/zero-debt-remediation-audit.md`](audits/zero-debt-remediation-audit.md).  
> **تاریخچهٔ شکست و اصلاح:** [Audit & Remediation History](#audit--remediation-history) — SB-01 و «Fully satisfied» بایگانی شده‌اند؛ Phase 3 نباید بدون خواندن آن‌ها seal بزند.

### Phase 2 — Theme ingress (current controls)

| Control | Implementation | Status |
|---------|----------------|--------|
| Workspace theme ingress | `validateWorkspaceThemeIngress` → `assertWorkspacePlugin` + `snapshotWorkspaceTheme` | ✅ |
| **SEC-001** (post-validation TOCTOU) | Immutable frozen snapshot; `resolvedTheme` not aliased to caller object | ✅ remediated |
| Tenant theme ingress | `validateTenantTheme` in `TenantThemeProvider` before DOM | ✅ |
| CSS value safety | `assertThemeCssValueIsSafe` — NFKC normalize, block `\` escapes, protocol/legacy patterns | ✅ |
| Stylesheet path | `optionalStylesheet` strictly relative (incl. Windows drive rejection) | ✅ |
| **Safety Seal** (API exports) | `SealedWorkspaceTheme` / `SealedTenantTheme` via `WeakSet`; DOM mappers **not** on `@app-tour/theme-react` `.` export; **L-01** `exports` = `.` only + `files` whitelist + `verify:exports` | ✅ **Verified Remediated** |
| **`@app-tour/theme-react`** | Public: `@app-tour/theme-react` (providers only). `./internal` / `./harness` **removed**. `dist/` locked to `files` allowlist. | ✅ **Verified Remediated** · `pnpm run guard:artifact-surface` |
| **`@app-tour/ui-primitives`** | Barrel `.` **deprecated** (not in `exports`). Subpaths only; `dist/tokens` pruned; explicit CSS `sideEffects`. | ✅ **Verified Remediated** · `audit-boundary` + `guard:import-boundary` |

**Current verdict (Phase 2):** **Verified Remediated** — ingress + provider path green; `dist/` parity enforced by `guard:artifact-surface`; consumer imports by `guard:import-boundary` + `audit-boundary`.

**Residual risk (documented; not seal blockers):** NFKC/pattern-list limits on CSS sanitization — see [Audit & Remediation History](#audit--remediation-history).

**Verification:**

```bash
pnpm --filter @app-tour/workspace-sdk test
pnpm --filter @app-tour/theme-react test
pnpm --filter @app-tour/theme-react run verify:exports   # L-01
pnpm run guard:import-boundary                           # AST: no ui-primitives barrel
pnpm run guard:artifact-surface                          # dist/ === files + exports
pnpm run audit-boundary                                  # ripgrep: no barrel imports
pnpm run phase-2:gate                                    # Phase 2.5 — required before Phase 3
```

---

## Audit & Remediation History

Permanent record of Phase 2 security claims, failures, and fixes. **Do not delete** when updating Phase 3 docs — false seals must remain visible so they are not repeated.

### Archived false claim — “Fully satisfied”

| When | What was claimed | Why it was wrong |
|------|------------------|------------------|
| Phase 2 gate (early) | **Phase 2 Security Seal: Fully satisfied** | MAP / gate treated “mappers not on `@app-tour/theme-react` **index**” as sufficient while **`@app-tour/theme-react/internal`** remained a **supported** export exposing `normalizeWorkspaceCssVariables` **without** ingress, seal, or `assertThemeCssValueIsSafe`. |

**Rule for Phase 3+:** Never restore the phrase **“Fully satisfied”** for theme export surface until `package.json` `exports`, `files`, `dist/` allowlist, and consumer `audit-boundary` are all green **and** forensic review confirms no parallel public bypass subpath.

**Replacement verdict (current):** **Verified Remediated** — `exports`/`files`/`dist/` parity (`guard:artifact-surface`); consumers use subpaths only (`guard:import-boundary`, `audit-boundary`).

---

### Phase 2 Security Breach (SB-01)

| Field | Detail |
|-------|--------|
| **ID** | SB-01 |
| **Severity** | **CRITICAL** |
| **Package** | `@app-tour/theme-react` |
| **Failure** | `package.json` published `"./internal"` → `dist/internal.js` re-exported `normalizeWorkspaceCssVariables`, `workspaceThemeToStyle`, and `buildTenantThemeStyle`. Callers could inject arbitrary `--*` keys/values into React `style={}` **without** `validateWorkspaceThemeIngress` or sealing. |
| **Doc lie** | Safety Seal table stated mappers were “not exported” while **`./internal` was a first-class export** — index-only interpretation of “internal”. |
| **Attack** | `import { normalizeWorkspaceCssVariables } from "@app-tour/theme-react/internal"` → unvalidated CSS variables on DOM. |

**SB-01 was a shipped security breach, not a theoretical finding.** See [`audits/zero-debt-remediation-audit.md`](audits/zero-debt-remediation-audit.md) · [`audits/phase-2-zero-debt-forensic-audit-2026-06-02.md`](audits/phase-2-zero-debt-forensic-audit-2026-06-02.md) (SB-01, D-01, D-02).

---

### Post-Phase Remediation

Remediation applied **after** the false “Fully satisfied” gate and forensic audits (2026-06-02). Phase 3 work must assume these guards stay in CI.

| Track | Action | Enforcement |
|-------|--------|-------------|
| **SB-01** | Removed `"./internal"` from `exports`; deleted `src/internal.ts`; `dist/internal.js` absent after build | `p2_theme_react_no_internal_export` |
| **SB-02 / L-01** | `@app-tour/theme-react`: `exports` allowlist (`.` only); `files` whitelist; production `tsc` excludes `src/harness/**`; `verify-export-allowlist.mjs` fails on stray `dist/` top-level entries (e.g. `harness/`) | `p2_theme_react_export_allowlist_l01` · `pnpm --filter @app-tour/theme-react run verify:exports` |
| **SB-03** | Harness helpers removed from public `.` export; Storybook / visual tests use **providers** instead of `@app-tour/theme-react/harness` | L-01 · no `./harness` in `exports` |
| **ui-primitives barrel** | Deprecated `@app-tour/ui-primitives` barrel; subpath-only `exports`; `dist/index.js` not built | `pnpm run audit-boundary` · `p2_ui_primitives_no_barrel` |
| **Zero-debt (Phase 2.5)** | `guard:artifact-surface`; CSS layout/keyword tokens; Badge `--color-border-strong`; `import-boundary-ast` barrel ban; explicit CSS `sideEffects` | `pnpm run phase-2:gate` |
| **Presets** | `workspaceThemePresets` frozen at module load | `workspace-sdk` theme tests |

---

### Audit record (SB-01 · SB-02 · SB-03)

| ID | Severity | Finding | Remediation | Status |
|----|----------|---------|-------------|--------|
| **SB-01** | **CRITICAL** | `./internal` export — unvalidated DOM mapper bypass (see [Phase 2 Security Breach](#phase-2-security-breach-sb-01)). | Removed subpath and source; rebuild; import ban in guard. | **Remediated** |
| **SB-02** | **HIGH** | Full `dist/**` on disk; “private” meant “not on index” only. | L-01 + `guard:artifact-surface`; ui-primitives `files` whitelist + `prune-dist`; no `dist/tokens` leakage. | **Verified Remediated** |
| **SB-03** | **HIGH** | Harness on production `.` export. | Stripped from public index; harness dev-only, excluded from production build. | **Remediated** |

> **Forensic references:** [`audits/zero-debt-remediation-audit.md`](audits/zero-debt-remediation-audit.md) · [`audits/phase-2-zero-debt-forensic-audit-2026-06-02.md`](audits/phase-2-zero-debt-forensic-audit-2026-06-02.md) · [`audit-red-flags-phase-0.md`](../audit-red-flags-phase-0.md).

### Phase 3 — do not repeat

- **Phase 2.5 (`phase-2:gate`) must pass before any Phase 3 PR merges.**
- Do not mark theme or primitive export seals **“Fully satisfied”** without `exports`/`files` parity, `guard:artifact-surface`, and `audit-boundary` on apps.
- CASL ([§15 in phase-2-design-system](phase-2-design-system.md#15-phase-3-infrastructure--access-control)) runs **before** theme ingress — it does not replace export-surface discipline.
- New packages: same pattern — **restricted subpath exports**, dist allowlist verify, consumer import audit.

---

## ۲۱. چه چیز از legacy برای Denali {#۲۱-legacy-denali-port-map}

| دارایی | مسیر legacy | مقصد |
|--------|-------------|------|
| Field registry & rules | `legacy/packages/denali-domain/` | `workspaces/denali/domain/` |
| Canonical wire types | `legacy/packages/types/src/denali/` | `workspaces/denali/types/` |
| Wizard smoke | `legacy/apps/web/.../smoke/` | acceptance criteria فاز ۶ |
| Finance / ledger patterns | `legacy/apps/api/modules/finance/` | plugin hooks + tenant layer |
| Tenant / RLS | `legacy/apps/api/` | فاز ۴ ([§7](#۷-tenant-isolation--poolhybridrouting)) |
| Event bus / outbox | `legacy/apps/api/src/common/events/` | فاز ۴–۵ ([§6](#۶-ارتباط-بین-ماژول‌ها--event-bus--outbox)) |
| Audit | `legacy/apps/api/src/common/audit/` | فاز ۵–۷ ([§10](#۱۰-observability--audit)) |
| Docker infra | `legacy/infra/docker-compose.yml` | [§5](#۵-infrastructure--سرویس‌های-واقعی-per-phase) |

---

## ۲۲. Definition of Done — کل پلتفرم {#۲۲-definition-of-done--کل-پلتفرم}

- [ ] فاز ۱–۷ complete
- [ ] Denali + workspace دوم روی **یک** engine
- [ ] core: صفر import از `workspaces/*`
- [ ] web shell: theme از plugin؛ token semantic در primitives
- [ ] API: `validate(plugin, canonical)` + `workspace_type`
- [ ] DB: `canonical_data` SoT
- [ ] **Infra:** Postgres + Redis + MinIO e2e سبز ([§5](#۵-infrastructure--سرویس‌های-واقعی-per-phase))
- [ ] **Events:** outbox + یک domain event end-to-end ([§6](#۶-ارتباط-بین-ماژول‌ها--event-bus--outbox))
- [ ] **Tenant:** RLS isolation + route interface برای hybrid ([§7](#۷-tenant-isolation--poolhybridrouting))
- [ ] **Plugins:** semver + migrateCanonical ([§8](#۸-plugin-lifecycle--versioning))
- [ ] **Observability:** audit + structured logs ([§10](#۱۰-observability--audit))
- [ ] CI سبز روی `main` برای هر gate

---

## ۲۳. شروع اجرا {#۲۳-شروع-اجرا}

**فاز جاری:** **3.2** — red-flag remediation (فاز ۰–۲ ✅ **Verified Remediated** · فاز ۳ **Scaffold** — [§12](#۱۲-the-zero-debt-covenant-mandatory-enforcement) · [`backlog/phase-3.2-red-flag-backlog.md`](backlog/phase-3.2-red-flag-backlog.md))

**سندهای فاز:**
- فاز ۰: [`phase-0-foundation.md`](phase-0-foundation.md)
- فاز ۱: [`phase-1-platform-core.md`](phase-1-platform-core.md)
- فاز ۲: [`phase-2-design-system.md`](phase-2-design-system.md)
- فاز ۳: [`phase-3-design-system.md`](phase-3-design-system.md)

```bash
nvm use && corepack enable
pnpm install
pnpm build && pnpm test && pnpm run guard:architecture
```

**مرجع کوتاه:** [`MIGRATION.md`](MIGRATION.md) · **این سند:** منبع حقیقت فازها و frontend enterprise.

---

## ۲۴. Future-Proofing: AI & Chat Integration {#۲۴-future-proofing-ai--chat-integration}

> **وضعیت:** آینده — بعد از DoD پلتفرم ([§22](#۲۲-definition-of-done--کل-پلتفرم)). بدون شکستن North Star: AI در core hardcode نمی‌شود.

### Architecture

AI integration will be treated as an **Extensibility Layer**. LLM-based assistants will be deployed as **workspace-specific plugins** via the existing [`WorkspacePlugin`](#۴-workspaceplugin--چه-چیز-داخل-plugin-است) contract.

| اصل | معنی |
|-----|------|
| **Plugin، نه core** | promptها، toolها، و UX چت داخل `packages/workspaces/<id>/` — نه `platform-core` |
| **همان contract** | registry، lifecycle، validation از workspace-sdk — بدون مسیر ویژهٔ Denali در engine |
| **اختیاری per workspace** | tenant می‌تواند assistant را فعال/غیرفعال کند بدون deploy جدا |

### Data Access

AI services will query the **CanonicalDocument** SoT via the **Event Bus** ([§6](#۶-ارتباط-بین-ماژول‌ها--event-bus--outbox)).

- خواندن state از **canonical** (یا projectionهای مشتق‌شده از outbox) — نه dual-write به store موازی.
- ابزارهای LLM (function calling) از APIهای generic platform عبور می‌کنند؛ orchestration در plugin.
- رویدادها برای invalidate cache / refresh context — consumerها idempotent با `tenant_id` روی هر پیام.

### Tenant Context

AI responses must be scoped by **`tenant_id`** at the infrastructure level, utilizing the established **RLS** policies to prevent cross-tenant data exposure ([§7](#۷-tenant-isolation--poolhybridrouting) · [§7.4](#۷۴-endpoint-isolation--context)).

- هر session چت و هر tool call → `SET LOCAL app.current_tenant_id` قبل از query.
- **ممنوع:** embedding یا retrieval روی دادهٔ بدون فیلتر tenant — حتی در vector store آینده.
- هم‌راستا با session واحد سه‌اپ ([§3.6](#۳۶-authentication--data-hydration)): auth tenant-scoped + RLS safety net.

---

## ۲۵. Phase protocol acknowledgment {#۲۵-phase-protocol-acknowledgment}

> **Superseded:** The binding **Zero-Debt Covenant**, **Phase Gate (Runtime Proof)** definition, and **Phase Gate Audit Table** live in [§12 The Zero-Debt Covenant](#۱۲-the-zero-debt-covenant-mandatory-enforcement). **Compliance-by-Design** rules: [§15](#۱۵-the-phase-gate-constitution)–[§18](#۱۸-documentation-truth). This section remains as a stable anchor for links that previously pointed at “§18 Phase Protocol”.

By working in this repository:

1. **Read** [§12](#۱۲-the-zero-debt-covenant-mandatory-enforcement) before Phase 4+ tasks and before closing Phase 3.2 red-flag backlog items.
2. **Run** Runtime Proof suites (not grep-only guards alone) before claiming completion.
3. **Update** the [Phase Gate Audit Table](#phase-gate-audit-table--runtime-proof-required) in the same PR.
4. **Halt** when a request conflicts with §12 — cite rule **R1–R5** or export rule **E1–E5**.

---

## ۲۶. Documentation Governance & DoD {#۲۶-documentation-governance--dod}

> **Pillar:** **Docs-as-Code** is a mandatory architectural pillar — documentation is versioned, reviewed, and gated like application code.  
> **Authority:** Complements [§12 The Zero-Debt Covenant](#۱۲-the-zero-debt-covenant-mandatory-enforcement) · [§14 Constitution](#۱۴-the-constitution-of-phases) · [§18 Documentation Truth](#۱۸-documentation-truth) — [§12.2 Verification-as-Code](#۱۲۲-verification-as-code) (Verification sections + Scaffold-Only labels · [§13](#۱۳-architecture-breaking-points)).

### Docs-as-Code (mandatory)

| Rule | Requirement |
|------|-------------|
| **Phase file** | Every platform phase **N** must have a corresponding guide under [`docs/`](.) (e.g. `phase-N-*.md`) **and** a row in [§11 فازبندی](#۱۱-فازبندی-migration) / [Phase Gate Audit Table](#phase-gate-audit-table--runtime-proof-required). Each guide **must** include a **Verification** section per [§12.2](#۱۲۲-reality-first-documentation). |
| **Forensic Truth** | Every phase guide **must** include **`§N.X Forensic Truth vs Marketing`** per [§14.4](#۱۴۴-self-referencing-audit-mandatory-phase-docs) — objective list of all **Aspirational** requirements. `guard:doc-sync` should treat missing marker as **FAIL** for phases in `phase-registry.json`. |
| **Registry** | [`docs/phase-registry.json`](phase-registry.json) is the machine-readable index; CI validates it against the filesystem. |
| **Audits** | Phase closure requires an archived audit under [`docs/audits/`](audits/README.md). **New** forensic reports use **Markdoc** (`.mdoc`) — see [Markdoc](#markdoc-structured-audits). |
| **Same PR** | Code that changes architecture, CASL, API boundaries, or phase scope **must** update the phase doc + `MIGRATION-MAP.md` in the **same PR**. |

### Doc-Gate (Definition of Done)

A feature or phase sub-milestone is **not Done** until:

1. **Architecture documentation** reflects the implementation (phase doc + MAP entry).
2. **`pnpm run doc-gate`** exits **0** (documentation sync + link validation + Markdoc parse + `audit-boundary`).
3. For Phase 3+ app work: [`docs/phase-3-design-system.md`](phase-3-design-system.md) includes **CASL logic** and **API boundary definitions** (§10.4) matching the repo.

```bash
pnpm run doc-gate              # full Doc-Gate (required before Phase 3.1 merge)
pnpm run guard:documentation-sync   # registry + links only (subset)
pnpm run doc:markdoc:validate  # parse all docs/**/*.mdoc
pnpm run audit-boundary        # import/barrel parity (also inside doc-gate)
```

**Phase 3.1 entry rule:** Do **not** start Phase 3.1 implementation until `pnpm run doc-gate` is green and the Markdoc scaffold under [`docs/markdoc/`](markdoc/config.mjs) is initialized.

### Markdoc (structured audits)

| Item | Path / command |
|------|----------------|
| Config | [`docs/markdoc/config.mjs`](markdoc/config.mjs) |
| Schema tags | [`docs/markdoc/schema/tags.mjs`](markdoc/schema/tags.mjs) |
| Forensic format | `docs/audits/*.mdoc` with YAML frontmatter (`title`, `phase`, `gitSha`, `verdict`) |
| Validator | `pnpm run doc:markdoc:validate` |

Legacy `.md` audits remain for history; **new** phase reports must be authored as `.mdoc` for structured querying and Doc-Gate validation.

### CI — Documentation Sync

| Step | Script | Behavior |
|------|--------|----------|
| **Documentation Sync** | `scripts/guards/documentation-sync.mjs` | Validates `phase-registry.json`, required phase files, relative links in `MIGRATION-MAP.md` + phase docs, and phase-doc required sections for the active phase. **Warns** on stale registry vs MAP; **fails** on missing files or broken links. |
| **Doc-Gate** | `scripts/guards/doc-gate.mjs` | Runs documentation-sync + `doc:markdoc:validate` + `audit-boundary`. |
| **Workflow** | [`.github/workflows/doc-gate.yml`](../.github/workflows/doc-gate.yml) | Runs on `push` / `pull_request` to `main`. |

### Enforcement IDs

| ID | Mechanism |
|----|-----------|
| `P3-E-DOC-01` | Doc-Gate + MAP / phase doc updates in closure PRs |
| `P3-E-DOC-GATE` | `pnpm run doc-gate` (Phase 3.1+ prerequisite) |
