# P2-A — Platform Gateway · Nano-Task Spec (AI Lite)

```yaml
doc_id: P2-A-PLATFORM-GATEWAY
version: 1.0-nano
nano_tasks: 16
parent_tasks: 8
start: P2-A-N-001
stop: P2-A-N-016
epic: P2-A
priority: P2-low
execute_after: P2-B · P2-C · P2-D · P2-E (Super Admin core first)
touch_allowlist:
  - apps/marketing/**
touch_forbidden:
  - packages/workspaces/denali/**
  - apps/api/**
  - apps/web/**          # except optional P2-A-N-016
  - apps/public/**
```

---

## برای AI — 7 قانون (بدون تحلیل سرخود)

1. **یک nano در هر بار** — `P2-A-N-001` → `N-002` → … — از وسط شروع نکن.
2. **IMPLEMENT `[I]` قبل از TEST `[T]`** — هر parent = دو nano پشت‌سرهم.
3. **فقط فایل‌های این spec** — اگر فایلی در spec نیست → **دست نزن** · re-architect ممنوع.
4. **Facts frozen §زیر** — دوباره codebase را explore نکن؛ اگر fact با repo conflict داشت → **STOP** · به Architect بگو.
5. **Denali:** `git diff packages/workspaces/denali` باید خالی بماند.
6. **تست:** حداقل 2 `assert` واقعی — `assert.ok(true)` ممنوع.
7. **VERIFY سبز نشد → STOP** — nano بعدی ممنوع.

---

## Facts frozen (تحلیل انجام شده — تکرار نکن)

| Fact | مقدار ثابت |
|------|------------|
| Mother hosts | `parseMultiLevelTenantHost` → `kind === "apex"` **یا** `kind === "reserved" && label === "www"` |
| Root env | `PLATFORM_ROOT_DOMAIN` (server) · dev: `localhost` |
| Super Admin URL | `https://admin.{PLATFORM_ROOT_DOMAIN}` — app **`apps/web` port 3000** |
| Marketing app | `apps/marketing` port **3002** |
| Club marketing host | `{subdomain}.{root}` → `kind === "club_apex"` — **باید مثل قبل کار کند** |
| Apex bug today | `resolve-marketing-bootstrap.ts` روی apex → fallback smoke tenant — **این EPIC fix می‌کند** |
| API apex | `/public/tenant-context` → 404 `TENANT_HOST_UNKNOWN` — **درست است · API تغییر نده** |
| Parser import | `@app-tour/tenant-kernel` — `parseMultiLevelTenantHost` · `parseReservedLabelsCsv` · `DEFAULT_TENANT_HOST_RESERVED_LABELS` |
| Out of scope | SEO · sitemap · checkout · `apps/public` · تغییر Denali · تغییر `/denali/catalog` |

---

## Parent task map

| Parent | عنوان | Nano |
|--------|--------|------|
| P2-A-T-001 | Root domain reader (marketing) | N-001 · N-002 |
| P2-A-T-002 | `isPlatformMotherHost` | N-003 · N-004 |
| P2-A-T-003 | `buildPlatformAdminUrl` | N-005 · N-006 |
| P2-A-T-004 | `PlatformMotherShell` UI | N-007 · N-008 |
| P2-A-T-005 | `MaintenancePage` UI | N-009 · N-010 |
| P2-A-T-006 | Layout bypass tenant bootstrap | N-011 · N-012 |
| P2-A-T-007 | Routes: `/` · `/pricing` · `/about` · `/contact` | N-013 · N-014 |
| P2-A-T-008 | Club host regression | N-015 · N-016 |

---

## NANO TASKS (16)

### P2-A-N-001 [IMPLEMENT] `P2-A-T-001` — readPlatformRootDomainMarketing

- **EPIC:** P2-A
- **Deps:** `—`

**DO THIS:**

1. Create dir: `apps/marketing/src/platform/`
2. Create `apps/marketing/src/platform/read-platform-root-domain.ts`:

```typescript
/** P2-A — server-only root domain (mirror apps/web pattern). */
export function readPlatformRootDomainMarketing(): string {
  const fromEnv = process.env.PLATFORM_ROOT_DOMAIN?.trim().toLowerCase();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv.replace(/^\.+|\.+$/g, "");
  }
  return "localhost";
}
```

**DO NOT:** import from `apps/api` · import denali · read `TENANT_ROOT_DOMAIN` here

**NEXT:** `P2-A-N-002`

**STATUS:** ⬜ Todo

---

### P2-A-N-002 [TEST] `P2-A-T-001` — readPlatformRootDomainMarketing

- **Deps:** `P2-A-N-001`

**Create:** `apps/marketing/test/read-platform-root-domain.spec.ts`

**Required assertions (exact):**

```typescript
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readPlatformRootDomainMarketing } from "../src/platform/read-platform-root-domain";

describe("readPlatformRootDomainMarketing", () => {
  it("uses PLATFORM_ROOT_DOMAIN when set", () => {
    const prev = process.env.PLATFORM_ROOT_DOMAIN;
    process.env.PLATFORM_ROOT_DOMAIN = "Example.COM";
    try {
      assert.equal(readPlatformRootDomainMarketing(), "example.com");
    } finally {
      process.env.PLATFORM_ROOT_DOMAIN = prev;
    }
  });

  it("defaults to localhost when unset", () => {
    const prev = process.env.PLATFORM_ROOT_DOMAIN;
    delete process.env.PLATFORM_ROOT_DOMAIN;
    try {
      assert.equal(readPlatformRootDomainMarketing(), "localhost");
    } finally {
      process.env.PLATFORM_ROOT_DOMAIN = prev;
    }
  });
});
```

**VERIFY:** `pnpm --filter @apps/marketing exec node --import tsx --test test/read-platform-root-domain.spec.ts`

**PASS:** 2 tests green

**DO NOT:** assert.ok(true)

**NEXT:** `P2-A-N-003`

**STATUS:** ⬜ Todo

---

### P2-A-N-003 [IMPLEMENT] `P2-A-T-002` — isPlatformMotherHost

- **Deps:** `P2-A-N-002`

**DO THIS:**

Create `apps/marketing/src/platform/is-platform-mother-host.ts`:

```typescript
import {
  DEFAULT_TENANT_HOST_RESERVED_LABELS,
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
} from "@app-tour/tenant-kernel";

import { readPlatformRootDomainMarketing } from "./read-platform-root-domain";

export function normalizeMarketingHost(host: string): string {
  return host.split(":")[0]?.trim().toLowerCase() ?? "";
}

/** True for platform root: apex or reserved www alias. */
export function isPlatformMotherHost(host: string): boolean {
  const hostname = normalizeMarketingHost(host);
  const root = readPlatformRootDomainMarketing();
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  const outcome = parseMultiLevelTenantHost(hostname, root, reserved);
  if (outcome.kind === "apex") return true;
  if (outcome.kind === "reserved" && outcome.label === "www") return true;
  return false;
}
```

**DO NOT:** return true for `club_apex` · import workspace-denali

**NEXT:** `P2-A-N-004`

**STATUS:** ⬜ Todo

---

### P2-A-N-004 [TEST] `P2-A-T-002` — isPlatformMotherHost

- **Deps:** `P2-A-N-003`

**Create:** `apps/marketing/test/platform-mother-host.spec.ts`

**Required assertions (minimum 4 cases):**

| host | `PLATFORM_ROOT_DOMAIN` | expected |
|------|------------------------|----------|
| `app-tour.ir` | `app-tour.ir` | `true` |
| `www.app-tour.ir` | `app-tour.ir` | `true` |
| `denali.localhost:3002` | `localhost` | `false` |
| `admin.localhost` | `localhost` | `false` |

**VERIFY:** `pnpm --filter @apps/marketing exec node --import tsx --test test/platform-mother-host.spec.ts`

**PASS:** all 4 green

**NEXT:** `P2-A-N-005`

**STATUS:** ⬜ Todo

---

### P2-A-N-005 [IMPLEMENT] `P2-A-T-003` — buildPlatformAdminUrl

- **Deps:** `P2-A-N-004`

**DO THIS:**

Create `apps/marketing/src/platform/build-platform-admin-url.ts`:

```typescript
import { readPlatformRootDomainMarketing } from "./read-platform-root-domain";

export function buildPlatformAdminUrl(): string {
  const root = readPlatformRootDomainMarketing();
  return `https://admin.${root}`;
}
```

**DO NOT:** relative URL `/admin` · link to port 3000

**NEXT:** `P2-A-N-006`

**STATUS:** ⬜ Todo

---

### P2-A-N-006 [TEST] `P2-A-T-003` — buildPlatformAdminUrl

- **Deps:** `P2-A-N-005`

**Create:** `apps/marketing/test/build-platform-admin-url.spec.ts`

**Required assertions:**

- env `app-tour.ir` → `https://admin.app-tour.ir`
- unset env → `https://admin.localhost`

**VERIFY:** `pnpm --filter @apps/marketing exec node --import tsx --test test/build-platform-admin-url.spec.ts`

**NEXT:** `P2-A-N-007`

**STATUS:** ⬜ Todo

---

### P2-A-N-007 [IMPLEMENT] `P2-A-T-004` — PlatformMotherShell

- **Deps:** `P2-A-N-006`

**DO THIS:**

Create `apps/marketing/src/platform/platform-mother-shell.tsx`:

- Server component (no `"use client"`)
- Props: `{ readonly children: React.ReactNode }`
- Render:
  - `<div data-platform-mother-shell>`
  - `<header data-platform-mother-header>` — text `app-tour`
  - `<a href={buildPlatformAdminUrl()} data-platform-admin-cta>ورود PlatformOps</a>`
  - `{children}`
  - **NO** `<Link href="/tours">` · **NO** tenant branding props

Use `buildPlatformAdminUrl()` from `./build-platform-admin-url`.

**DO NOT:** import `MarketingShell` · import denali

**NEXT:** `P2-A-N-008`

**STATUS:** ⬜ Todo

---

### P2-A-N-008 [TEST] `P2-A-T-004` — PlatformMotherShell grep

- **Deps:** `P2-A-N-007`

**No runtime test.** File grep only.

**VERIFY:**

```bash
grep -q 'data-platform-mother-shell' apps/marketing/src/platform/platform-mother-shell.tsx && \
grep -q 'data-platform-admin-cta' apps/marketing/src/platform/platform-mother-shell.tsx && \
grep -q 'buildPlatformAdminUrl' apps/marketing/src/platform/platform-mother-shell.tsx && \
! grep -q '/tours' apps/marketing/src/platform/platform-mother-shell.tsx
```

**PASS:** exit 0

**NEXT:** `P2-A-N-009`

**STATUS:** ⬜ Todo

---

### P2-A-N-009 [IMPLEMENT] `P2-A-T-005` — MaintenancePage

- **Deps:** `P2-A-N-008`

**DO THIS:**

Create `apps/marketing/src/platform/maintenance-page.tsx`:

- Props: `{ readonly title: string }` (fa title per route)
- Body text fa: `این بخش در دست تعمیر است.`
- Link home `/` · link admin via `buildPlatformAdminUrl()`
- Root: `data-platform-maintenance`

**DO NOT:** call API · i18n keys (hardcode fa OK)

**NEXT:** `P2-A-N-010`

**STATUS:** ⬜ Todo

---

### P2-A-N-010 [TEST] `P2-A-T-005` — MaintenancePage grep

- **Deps:** `P2-A-N-009`

**VERIFY:**

```bash
grep -q 'data-platform-maintenance' apps/marketing/src/platform/maintenance-page.tsx && \
grep -q 'در دست تعمیر' apps/marketing/src/platform/maintenance-page.tsx
```

**PASS:** exit 0

**NEXT:** `P2-A-N-011`

**STATUS:** ⬜ Todo

---

### P2-A-N-011 [IMPLEMENT] `P2-A-T-006` — Layout branch (skip tenant bootstrap)

- **Deps:** `P2-A-N-010`

**DO THIS:**

1. **Read first (do not rewrite whole file):** `apps/marketing/app/layout.tsx`

2. At start of `RootLayout`, after `headers()`:
   - `const host = headerList.get("host") ?? "localhost:3002"`
   - `if (isPlatformMotherHost(host))` → return minimal html:
     - keep `lang`/`dir` from existing locale logic OR default `fa`/`rtl`
     - wrap `{children}` in `<PlatformMotherShell>{children}</PlatformMotherShell>`
     - **SKIP** `fetchPublicTenantBrandingForHost` · **SKIP** `MarketingShell` · **SKIP** `MarketingProviders` tenant theme OR pass empty theme

3. Else → **existing club path unchanged** (copy current block as-is)

**DO NOT:** edit `resolve-marketing-bootstrap.ts` in this nano · edit `packages/workspaces/denali`

**NEXT:** `P2-A-N-012`

**STATUS:** ⬜ Todo

---

### P2-A-N-012 [TEST] `P2-A-T-006` — Layout branch grep

- **Deps:** `P2-A-N-011`

**VERIFY:**

```bash
grep -q 'isPlatformMotherHost' apps/marketing/app/layout.tsx && \
grep -q 'PlatformMotherShell' apps/marketing/app/layout.tsx && \
grep -q 'fetchPublicTenantBrandingForHost' apps/marketing/app/layout.tsx
```

**PASS:** first two grep hit · third still present (club branch uses it)

**NEXT:** `P2-A-N-013`

**STATUS:** ⬜ Todo

---

### P2-A-N-013 [IMPLEMENT] `P2-A-T-007` — Gateway routes

- **Deps:** `P2-A-N-012`

**DO THIS:**

**A) Replace branch in `apps/marketing/app/page.tsx`:**

At top of default export (server component):

```typescript
import { headers } from "next/headers";
import { isPlatformMotherHost } from "@/platform/is-platform-mother-host";
import { buildPlatformAdminUrl } from "@/platform/build-platform-admin-url";
// keep existing imports for club path
```

Logic:

```
host = headers().get("host") ?? ""
if isPlatformMotherHost(host):
  return (
    <main data-platform-mother-home>
      <h1>پلتفرم مدیریت باشگاه کوهنوردی</h1>
      <a href={buildPlatformAdminUrl()} data-platform-admin-cta>ورود PlatformOps</a>
    </main>
  )
else:
  return existing MarketingHomePage body (unchanged)
```

**B) Create 3 pages (server components):**

| File | title prop | mother-only guard |
|------|------------|-------------------|
| `apps/marketing/app/pricing/page.tsx` | `قیمت‌گذاری` | if !mother → `notFound()` from `next/navigation` |
| `apps/marketing/app/about/page.tsx` | `درباره ما` | same |
| `apps/marketing/app/contact/page.tsx` | `تماس` | same |

Each: import `headers`, `isPlatformMotherHost`, render `<MaintenancePage title=... />`.

**DO NOT:** delete `/tours` routes · add API routes

**NEXT:** `P2-A-N-014`

**STATUS:** ⬜ Todo

---

### P2-A-N-014 [TEST] `P2-A-T-007` — Gateway routes grep

- **Deps:** `P2-A-N-013`

**VERIFY:**

```bash
grep -q 'data-platform-mother-home' apps/marketing/app/page.tsx && \
test -f apps/marketing/app/pricing/page.tsx && \
test -f apps/marketing/app/about/page.tsx && \
test -f apps/marketing/app/contact/page.tsx && \
grep -q 'notFound' apps/marketing/app/pricing/page.tsx
```

**PASS:** exit 0

**NEXT:** `P2-A-N-015`

**STATUS:** ⬜ Todo

---

### P2-A-N-015 [IMPLEMENT] `P2-A-T-008` — Club regression spec

- **Deps:** `P2-A-N-014`

**DO THIS:**

Create `apps/marketing/test/platform-mother-club-unchanged.spec.ts`:

**Assert:**

1. `isPlatformMotherHost("denali.localhost:3002") === false` when root `localhost`
2. `isPlatformMotherHost("localhost:3002") === true` when root `localhost` (apex)

**Purpose:** document that club subdomain is NOT mother; apex localhost IS mother for dev.

**DO NOT:** change `resolve-host-tenant.ts`

**NEXT:** `P2-A-N-016`

**STATUS:** ⬜ Todo

---

### P2-A-N-016 [TEST] `P2-A-T-008` — Full marketing test + Denali gate

- **Deps:** `P2-A-N-015`

**VERIFY (run all — any fail → STOP):**

```bash
pnpm --filter @apps/marketing exec node --import tsx --test test/**/*.spec.ts
pnpm run guard:import-boundary
git diff --quiet packages/workspaces/denali
```

**PASS:** marketing tests green · import boundary OK · denali diff empty

**OPTIONAL (not exit blocker):** footer link in `apps/web/src/platform/platform-shell.tsx` → skip unless Architect asks

**NEXT:** `—` (P2-A complete)

**STATUS:** ⬜ Todo

---

## EPIC exit (همه باید ✅)

- [ ] N-001 … N-016 all STATUS Done
- [ ] Host `localhost` (apex) → gateway home · not `/tours` as primary CTA on `/`
- [ ] Host `denali.localhost` → existing club marketing path unchanged
- [ ] `packages/workspaces/denali` — zero diff

---

## STOP conditions (AI گم نشود)

| If you see… | Then… |
|-------------|--------|
| Tempted to create `apps/public` | **STOP** — forbidden |
| Tempted to edit `apps/api` | **STOP** — forbidden except Architect |
| Tempted to import denali | **STOP** — run boundary guard |
| `resolve-marketing-bootstrap` rewrite for all hosts | **STOP** — only layout branch (N-011) |
| Club `/tours` broken | **STOP** — revert N-011 club branch |
| New env beyond `PLATFORM_ROOT_DOMAIN` | **STOP** — ask Architect |

---

## مراجع (read-only — فقط اگر nano گفت)

| Path | Why |
|------|-----|
| `packages/tenant-kernel/src/host/parse-multi-level-tenant-host.ts` | host kinds |
| `apps/marketing/src/tenant/resolve-marketing-bootstrap.ts` | bug context — do not rewrite in P2-A |
| `apps/web/src/platform/create-club/build-club-site-preview.ts` | URL pattern mirror |
| `TEMP/p2/p2-denali-safety.md` | covenant |
