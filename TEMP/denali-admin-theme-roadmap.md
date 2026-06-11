# Denali Admin Theme — Enterprise Roadmap

```yaml
doc_id: TEMP-DENALI-THEME-ROADMAP
version: "2026-06-10-v1"
status: PLANNING
workspace: denali
stack: Next.js 15 · Tailwind v4 · shadcn/ui · @app-tour/design-tokens · theme-react
authority:
  - docs/phase-2-design-system.md §5 (3-layer theme)
  - docs/phase-4/subphases/4.4-tenant-theme.md
  - packages/workspaces/denali/theme/tokens.css
```

## 1. هدف محصول

ادمین‌پنل Denali برای **اپراتورهای کوهنوردی / طبیعت‌گردی / تورهای فضای باز** است — نه یک داشبورد SaaS عمومی.

| محور | هدف UX |
|------|--------|
| **اعتماد و ثبات** | رنگ‌های زمینی، نه نئون شلوغ |
| **خوانایی داده** | پس‌زمینه روشن، کنتراست WCAG AA برای جدول/متریک |
| **هویت ماجراجویی** | سبز جنگل + سنگ/خاک به‌عنوان accent ثانویه |
| **حرفه‌ای اپراتوری** | چگالی مناسب، sidebar واضح، CTAهای کم‌تعداد |

---

## 2. تحقیق بازار (خلاصه)

### پالت‌های مناسب outdoor / adventure (2024–2025)

| منبع | الگو | برداشت برای Denali admin |
|------|------|---------------------------|
| Mountain Heritage palette | Timber `#224422`, Alpine `#31547e`, Buckskin `#765832` | سبز عمیق + آبی افقی + قهوه‌ای گرم برای badge/illustration |
| Outdoor Earth + Forest | Emerald `#216E21`, Warm Gray Mist `#E7E6E4` | پس‌زمینه page نرم، primary سبز طبیعی |
| San Rita (Refero) | Forest canopy `#161b13` + chartreuse accent | **فقط برای dark mode اختیاری** — نه light admin پیش‌فرض |
| shadcn multi-brand best practice | `data-theme` / CSS variables روی `:root` | **یک منبع توکن** — بدون patch تک‌تک دکمه‌ها |

### آنچه عمداً انتخاب **نمی‌کنیم**

- پس‌زمینه تمام‌تیره به‌عنوان default (خستگی چشم در جدول‌های رزرو)
- نارنجی sunset پرانرژی به‌عنوان primary (مناسب marketing، نه ops ۸ ساعته)
- رنگ‌های hardcode در `button.tsx` / `card.tsx`

---

## 3. پیشنهاد پالت Denali (Light — پیش‌فرض اپراتور)

### 3.1 Primitive tokens (نام ثابت در design-system)

| Token | مقدار | نقش |
|-------|--------|-----|
| `--denali-forest-700` | `#0f5c4a` | Primary hover / sidebar active |
| `--denali-forest-600` | `#0f766e` | **Primary** (جایگزین `#059669` فعلی — کمی عمیق‌تر) |
| `--denali-forest-500` | `#14b8a6` | Ring / focus subtle |
| `--denali-alpine-600` | `#31547e` | Info, لینک ثانویه، chart |
| `--denali-stone-500` | `#78716c` | Muted text outdoor |
| `--denali-bark-600` | `#765832` | Badge سطح سختی تور، accent گرم |
| `--denali-mist-50` | `#f4f7f4` | Page background (جای `#f6f7f9` سرد) |
| `--denali-mist-100` | `#e8efe8` | Muted surface / sidebar hover |
| `--denali-snow` | `#ffffff` | Card surface |

### 3.2 Semantic mapping → shadcn (روی `html[data-workspace="denali"]`)

```css
/* هدف — packages/workspaces/denali/theme/admin-skin.css */
html[data-workspace="denali"] {
  /* Platform layer */
  --color-primary: var(--denali-forest-600);
  --color-primary-hover: var(--denali-forest-700);
  --color-primary-fg: #ffffff;
  --color-bg-page: var(--denali-mist-50);
  --color-bg-muted: var(--denali-mist-100);
  --color-text-link: var(--denali-forest-600);
  --color-info: var(--denali-alpine-600);
  --color-info-bg: #e8f0f8;
  --color-success: #166534;
  --color-success-bg: #dcfce7;
  --color-warning: #b45309;
  --color-warning-bg: #fff7ed;
  --focus-ring-color: rgb(15 118 110 / 0.35);

  /* shadcn bridge (از globals.css ارث می‌برد اگر --color-* ست شود) */
  --radius: 0.5rem;

  /* Sidebar operator shell */
  --sidebar: #ffffff;
  --sidebar-foreground: #1a1f26;
  --sidebar-primary: var(--denali-forest-600);
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: var(--denali-mist-100);
  --sidebar-accent-foreground: var(--denali-forest-700);
  --sidebar-border: #dce5dc;
}
```

### 3.3 Dark mode (فاز ۶ — اختیاری)

| Token | مقدار |
|-------|------|
| `--color-bg-page` | `#161b13` (forest canopy) |
| `--color-bg-surface` | `#1f2620` |
| `--color-primary` | `#5eead4` (teal-300) روی پس‌زمینه تیره |
| Accent CTA | `#c8f7b4` chartreuse ملایم (فقط دکمه‌های primary) |

---

## 4. معماری enterprise (هم‌راستا با monorepo)

### 4.1 سه لایه — بدون شکستن مرزها

```text
Level 1  design-tokens          پلتفرم خنثی (starter / default)
Level 2  tenants.theme (JSON)    white-label مشتری (لوگو، primary override)
Level 3  workspace denali skin  شخصیت vertical کوهنوردی
         └ shadcn semantic      --primary, --sidebar-* روی html
```

### 4.2 مشکل فعلی (ریشه‌ای)

`TenantThemeProvider` توکن را روی `div[data-tenant-theme]` می‌گذارد؛ shadcn/Tailwind از `:root` و `bg-primary` می‌خواند → دکمه‌ها آبی `#1e5a8e` می‌مانند.

### 4.3 راه‌حل حرفه‌ای (توصیه قطعی)

| گام | محل | کار |
|-----|-----|-----|
| A | `apps/web/app/layout.tsx` | `data-workspace="denali"` روی `<html>` وقتی plugin=denali |
| B | `packages/workspaces/denali/theme/admin-skin.css` | توکن‌های کامل Denali + sidebar |
| C | `denali.plugin.ts` | `optionalStylesheet: "theme/admin-skin.css"` |
| D | `WorkspaceThemeProvider` | inject stylesheet link (موجود) + ingress guard |
| E | `apps/web/globals.css` | بدون تغییر در کامپوننت‌ها — فقط bridge موجود |
| F | `tenants.theme` در seed | `primaryColor: #0f766e` — لایه tenant برای white-label |

**قانون طلایی shadcn:** هیچ `className="bg-[#0f766e]"` در صفحات — فقط `bg-primary`, `text-muted-foreground`, `border-border`.

### 4.4 تفکیت tenant vs workspace

| | Workspace skin (Denali) | Tenant theme |
|--|----------------------|--------------|
| مالک | `@app-tour/workspace-denali` | هر tenant در Postgres |
| مثال | sidebar layout، radius، mist background | لوگو، primary کمی متفاوت |
| Override | ثابت برای همه tenantهای denali | per-tenant در آینده |

---

## 5. Typography & density

| تصمیم | مقدار | دلیل |
|-------|--------|------|
| Body FA | Vazirmatn (موجود) | خوانایی فارسی |
| Body EN | Inter (موجود) | ops numerics |
| Heading | `font-semibold tracking-tight` | مدرن، نه condensed outdoor display |
| Density | `comfortable` default | `data-density="compact"` فقط جدول bookings در فاز ۳ |
| Icon set | Lucide (موجود) | `Mountain`, `Trees`, `MapPin` در empty state — نه در هر آیکن منو |

---

## 6. الگوهای UI شاخص Denali

| الگو | پیاده‌سازی shadcn |
|------|-------------------|
| Sidebar اپراتور | `Sidebar` + `--sidebar-primary` سبز |
| KPI cards | `Card` + `text-muted-foreground` label + `text-2xl font-semibold` |
| وضعیت تور | `Badge` variant: `default` تأیید / `secondary` پیش‌نویس / `outline` ظرفیت |
| سختی تور | `Badge` با `--denali-bark-600` background ملایم |
| ویزارد ۶ مرحله | `Stepper` موجود + progress rail سبز |
| Empty state | illustration خطی کوه + CTA `Button` primary |
| جدول رزرو | `Table` + sticky header + zebra `bg-muted/40` |

---

## 7. فازبندی اجرا

### فاز ۰ — Foundation (پیش‌نیاز همه صفحات) ⏱ ~1–2 روز

- [ ] `admin-skin.css` در `packages/workspaces/denali/theme/`
- [ ] `data-workspace` روی `<html>` از layout
- [ ] به‌روز `DEFAULT_TENANT_BRANDING` denali → `#0f766e`
- [ ] `db:seed` + invalidate tenant cache
- [ ] تست: دکمه primary سبز در dashboard (نه آبی)
- [ ] Guard: TH-1 tenant isolation همچنان سبز

**خروجی قابل قبول:** یک screenshot dashboard با primary سبز یکدست.

---

### فاز ۱ — Operator shell (layout مشترک) ⏱ ~2–3 روز

صفحات: `(app)/layout.tsx`, sidebar, header, user menu, dark toggle

- [ ] Sidebar: برند «ورک‌اسپیس Denali» + آیکن workspace
- [ ] Nav active state: border-r سبز + `sidebar-accent`
- [ ] Header: breadcrumb + tenant badge
- [ ] دکمه «تور جدید» sticky در sidebar
- [ ] Responsive: drawer موبایل

**فایل‌های محور:**

- `apps/web/src/components/app-sidebar.tsx` (یا معادل)
- `apps/web/app/(app)/layout.tsx`

---

### فاز ۲ — Dashboard ⏱ ~1–2 روز

صفحه: `/dashboard`

- [ ] KPI grid ۴ ستونه
- [ ] Card تورها / رزروها / مالی با skeleton loading
- [ ] Empty states با copy فارسی کوهنوردی
- [ ] Quick actions با `Button` + `Button variant="outline"`

---

### فاز ۳ — Tours ⏱ ~3–4 روز

صفحات: `/tours`, `/tours/new`, `/tours/[id]/edit`, workspace sub-routes

- [ ] لیست تور: فیلتر دسته (کوهنوردی/کویر/…) + Badge سختی
- [ ] ویزارد: stepper سبز، فیلدهای Denali بدون تغییر logic
- [ ] Photo step: grid مدرن
- [ ] Pricing: numeric inputs با locale

---

### فاز ۴ — Bookings ⏱ ~2–3 روز

صفحات: `/bookings`, `/bookings/new`, `/bookings/[id]`

- [ ] Command center table — density compact
- [ ] Status chips: pending=warning, confirmed=success
- [ ] Timeline فعالیت رزرو

---

### فاز ۵ — Settings hub ⏱ ~3–4 روز

صفحات: `/settings/*` (locations, equipment, tour-presets, …)

- [ ] Settings hub grid (کارت‌های ماژول)
- [ ] فرم‌های یکسان: `FieldShell` + spacing ثابت
- [ ] Locations/equipment: empty state راهنما

---

### فاز ۶ — Users + Finance + Leader ⏱ ~2–3 روز

صفحات: `/users`, `/finance`, `/leader/review`

- [ ] Users directory table
- [ ] Finance KPI + charts (رنگ‌های chart از alpine/forest)
- [ ] Leader review queue

---

### فاز ۷ — Polish & closure ⏱ ~2 روز

- [ ] Dark mode Denali (اختیاری)
- [ ] `playwright` smoke denali theme
- [ ] doc به‌روز در `docs/workspaces/denali/theme.md`
- [ ] حذف hardcode آبی باقی‌مانده در `components/ui/*` اگر هست

---

## 8. چک‌لیست کیفیت هر صفحه (قبل از merge)

```text
□ فقط توکن semantic (bg-primary نه hex)
□ RTL فارسی درست
□ Focus ring سبز دیده می‌شود
□ Loading skeleton هم‌خانواده
□ Empty state دارد
□ Mobile breakpoint بدون شکست layout
□ workspace=urban روی همان shell تأثیر نمی‌گذارد (isolation)
```

---

## 9. مراجع

- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) — CSS variables + `@theme inline`
- [Multi-brand shadcn (data-theme)](https://devcheolu.com/en/posts/rsKf3YSjiEKxTkAEtgtL)
- [Mountain Heritage palette](https://thecolorpalettestudio.com/blogs/color-palettes/mountain-heritage-a-rugged-palette-for-adventure-brands)
- [Outdoor Earth + Forest](https://colorarchive.org/collections/outdoor-earth-forest/)
- داخلی: `docs/phase-2-design-system.md` §5, `apps/web/app/globals.css`

---

## 10. گام بعدی پیشنهادی

**شروع از فاز ۰** — بدون آن، فاز ۱–۷ هر صفحه را جدا patch می‌کنید و دوباره دچار آبی `:root` می‌شوید.

بعد از تأیید تو، فاز ۰ را در کد پیاده می‌کنیم؛ سپس صفحه‌به‌صفحه از فاز ۱ (shell) جلو می‌رویم.

---

## 11. فراتر از رنگ — تجربه Denali (Experience Layer)

هدف: پنل **نرم، مدرن، تمیز و حرفه‌ای** — حس اپراتوری premium بدون شلوغی marketing.

### 11.1 اصول طراحی تعامل (Interaction Principles)

| اصل | معنی عملی | anti-pattern |
|-----|-----------|--------------|
| **Subtle motion** | 150–250ms برای hover/focus؛ 300ms برای drawer/page | parallax، bounce زیاد، framer-motion سنگین در هر صفحه |
| **Purposeful feedback** | دکمه: hover + active press؛ nav: indicator slide | انیمیشن بدون تغییر state |
| **Soft surfaces** | radius بزرگ‌تر، سایه ملایم، border کم‌کنتراست | کارت تخت بدون depth در dashboard |
| **Calm density** | فاصله breathing در shell؛ compact فقط در جدول | padding یکسان در همه جا |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` — الزام فاز ۲ | نادیده گرفتن a11y |

### 11.2 توکن‌های Motion (پیشنهاد — در `admin-skin.css` + اختیاری گسترش `primitives.css`)

```css
html[data-workspace="denali"] {
  /* Duration */
  --motion-duration-instant: 0ms;
  --motion-duration-fast: 150ms;
  --motion-duration-normal: 220ms;
  --motion-duration-slow: 320ms;

  /* Easing — natural deceleration (Material / Apple HIG aligned) */
  --motion-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --motion-ease-emphasized: cubic-bezier(0.2, 0, 0, 1.2);
  --motion-ease-exit: cubic-bezier(0.4, 0, 1, 1);

  /* Semantic aliases for components */
  --motion-interactive: var(--motion-duration-fast) var(--motion-ease-standard);
  --motion-surface: var(--motion-duration-normal) var(--motion-ease-standard);
  --motion-nav-indicator: var(--motion-duration-normal) var(--motion-ease-emphasized);
}
```

```css
@media (prefers-reduced-motion: reduce) {
  html[data-workspace="denali"] {
    --motion-duration-fast: 0ms;
    --motion-duration-normal: 0ms;
    --motion-duration-slow: 0ms;
  }
}
```

**قانون enterprise:** motion tokens فقط با prefix `--motion-*` یا `--ws-motion-*` در workspace skin — **نه** hardcode `duration-200` پراکنده در ۲۵ صفحه.

---

## 12. نرمی بصری (Surface & Shape)

### 12.1 Geometry — «شکل» جدید Denali

| Token | Platform فعلی | Denali پیشنهاد | اثر |
|-------|---------------|----------------|-----|
| `--radius` | `0.375rem` (6px) | `0.625rem` (10px) | دکمه/کارت نرم‌تر |
| `--radius-lg` | +4px | `0.875rem` (14px) | modal، drawer |
| `--shadow-card` | تخت تقریباً | `0 1px 2px rgb(15 23 42 / 0.04), 0 4px 12px rgb(15 23 42 / 0.06)` | depth ملایم KPI |
| `--shadow-popover` | موجود | کمی spread بیشتر + blur | dropdown حرفه‌ای |
| Border card | `border-border` | `border-border/60` در skin | خطوط کمتر خشک |

### 12.2 Spacing shell

| ناحیه | فعلی | Denali |
|-------|------|--------|
| Sidebar width | `w-64` (16rem) | `w-[17.5rem]` — فضای برند |
| Main padding | `p-4 md:p-6` | `p-5 md:p-8` |
| Page max-width | `max-w-6xl` | `max-w-7xl` برای dashboard |
| Nav item gap | `gap-1` | `gap-0.5` + padding داخلی بیشتر |
| Card internal | `p-6` | `p-5 md:p-6` — متعادل |

### 12.3 Typography softness

- عنوان صفحه: `text-2xl font-semibold tracking-tight` (نه bold سنگین)
- زیرعنوان: `text-sm text-muted-foreground leading-relaxed`
- Label فرم: `text-sm font-medium` — یکپارچه در settings

---

## 13. الگوهای تعامل کامپوننت (shadcn + shell)

### 13.1 دکمه‌ها (`button.tsx` — فقط via `data-workspace` skin یا variant extension)

**پیشنهاد enterprise:** یک فایل `packages/workspaces/denali/theme/interactions.css` که روی shell scope می‌شود:

```css
html[data-workspace="denali"] [data-slot="button"],
html[data-workspace="denali"] .btn-interactive {
  transition:
    background-color var(--motion-interactive),
    color var(--motion-interactive),
    box-shadow var(--motion-interactive),
    transform var(--motion-duration-fast) var(--motion-ease-standard);
}

html[data-workspace="denali"] button:active:not(:disabled),
html[data-workspace="denali"] a[data-interactive]:active {
  transform: scale(0.98);
}

html[data-workspace="denali"] .bg-primary {
  box-shadow: 0 1px 2px rgb(15 118 110 / 0.2);
}
html[data-workspace="denali"] .bg-primary:hover {
  box-shadow: 0 2px 8px rgb(15 118 110 / 0.25);
}
```

| Variant | رفتار Denali |
|---------|--------------|
| `default` | سایه سبز خیلی ملایم + hover روشن‌تر 4% |
| `outline` | border `primary/25` → hover `bg-accent/80` |
| `ghost` | hover با `bg-muted/80` نه جهش رنگ |
| `secondary` | پس‌زمینه mist |

**تغییر platform-wide نمی‌دهیم** — urban/starter دست‌نخورده.

### 13.2 Navigation (`operator-nav.tsx`)

| بهبود | پیاده‌سازی |
|-------|------------|
| Indicator slide | `transition-[inset-inline-start,width] var(--motion-nav-indicator)` روی bar سبز |
| Active pill | `bg-primary/8` + indicator به‌جای فقط `bg-accent/60` |
| Hover | `translate-x-0.5` در LTR / logical equivalent در RTL |
| Icon (فاز ۱) | Lucide 18px کنار label — فقط shell |

### 13.3 Card & KPI

```css
html[data-workspace="denali"] [data-denali-surface="card"] {
  transition: box-shadow var(--motion-surface), border-color var(--motion-surface);
}
html[data-workspace="denali"] [data-denali-surface="card"]:hover {
  box-shadow: var(--shadow-card-hover); /* تعریف در skin */
  border-color: rgb(15 118 110 / 0.12);
}
```

- Stagger ورود dashboard: `animation: denali-fade-up` با delay 50ms per card — **فقط** `@keyframes` در workspace CSS، نه JS library.

### 13.4 Input / Select

- Focus: `ring-2 ring-primary/30` + `border-primary/40`
- Transition: `border-color`, `box-shadow` با `--motion-fast`
- موجود: `transition-colors` — گسترش به `transition-[color,box-shadow,border-color]`

### 13.5 Sheet / Dialog (mobile nav)

- Radix `animate-in` موجود — duration را در skin به `300ms` یکدست
- Overlay: `bg-black/50` به‌جای `/80` برای نرم‌تر شدن

### 13.6 Header

- `backdrop-blur-md` + `border-b border-border/50`
- سایه بسیار کم: `shadow-sm shadow-black/5` هنگام scroll (optional `IntersectionObserver` در فاز ۷)

### 13.7 Brand block (`operator-brand.tsx`)

| فعلی | Denali |
|------|--------|
| حرف اول در مربع | لوگوی Mountain outline (SVG در `denali/theme/`) یا monogram «D» با gradient سبز ملایم |
| `h-10 w-10` | `h-11 w-11 rounded-xl` |
| بدون tagline | زیرنویس کوتاه: «طبیعت‌گردی و کوهنوردی» (i18n key جدید) |

---

## 14. معماری enterprise — کجا چه چیزی عوض می‌شود

```text
packages/design-tokens/          ← بدون denali literal (P2 V1 guard)
packages/ui-primitives/          ← بدون تغییر رفتار per-workspace
packages/workspaces/denali/theme/
  ├── admin-skin.css             ← رنگ + radius + shadow + motion tokens
  ├── interactions.css           ← button/card/nav micro-interactions
  ├── animations.css             ← @keyframes fade-up, skeleton shimmer
  └── assets/logo-mark.svg       ← brand mark
apps/web/src/admin/shell/        ← data-attribute + Denali-only layout classes
  └── operator-shell.tsx         ← data-workspace="denali" روی wrapper (یا html)
apps/web/components/ui/          ← تغییرات فقط اگر semantic و platform-wide
```

### 14.1 Scope selector (isolation)

```css
/* همه قوانین Denali */
html[data-workspace="denali"] { ... }

/* یا هم‌راستا با shell موجود */
[data-operator-shell][data-workspace-plugin="denali"] { ... }
```

**تست isolation:** urban tenant → همان shell بدون transform scale و بدون radius 10px.

### 14.2 بدون وابستگی جدید

| مجاز | غیرمجاز (فاز ۰–۷) |
|------|-------------------|
| CSS transitions + `@keyframes` | `framer-motion` dependency |
| Radix/shadcn `animate-in` | Lottie در هر صفحه |
| `tw-animate-css` / tailwind animate utilities موجود | GSAP |

---

## 15. فازبندی به‌روز (Experience-aware)

### فاز ۰ — Token + Motion Foundation

- [ ] `admin-skin.css` + `interactions.css` + `animations.css`
- [ ] `data-workspace="denali"` propagation
- [ ] motion tokens + `prefers-reduced-motion`
- [ ] radius/shadow نرم
- [ ] تأیید بصری: دکمه press + nav indicator slide

### فاز ۱ — Shell reshape (بیشترین تأثیر بصری)

- [ ] Sidebar عریض‌تر + brand جدید + tagline
- [ ] Nav icons + animated indicator
- [ ] Header blur نرم
- [ ] CTA «تور جدید» با سایه primary
- [ ] Main area spacing

### فاز ۲ — Dashboard polish

- [ ] KPI cards با hover lift
- [ ] Stagger fade-up (reduced-motion safe)
- [ ] Skeleton shimmer سبز-خاکستری
- [ ] Empty states با illustration

### فاز ۳–۶ — صفحات (همان ترتیب قبلی + الگوی مشترک)

هر صفحه:
1. `PageHeader` یکسان (title + description + actions)
2. `data-denali-surface="card"` روی کارت‌ها
3. جدول: row hover `bg-muted/50 transition-colors`
4. فرم: spacing و focus یکسان

### فاز ۷ — Closure

- [ ] Playwright: snapshot denali shell
- [ ] a11y: focus visible + reduced motion
- [ ] doc: `docs/workspaces/denali/admin-experience.md` (وقتی کد stable شد)

---

## 16. الگوی PageHeader (قالب مشترک همه صفحات)

```tsx
// apps/web/src/admin/patterns/page-header.tsx — فاز ۱
<header className="mb-6 md:mb-8 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
  <div className="space-y-1">
    <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
    {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
  </div>
  {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
</header>
```

---

## 17. مرجع الهام (motion + admin UX)

- [Material Motion — easing/duration](https://m3.material.io/styles/motion/easing-and-duration)
- [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- Linear / Vercel dashboard — subtle border, soft shadow, minimal animation
- shadcn — `transition-colors` baseline؛ ما layer تعامل workspace را اضافه می‌کنیم

---

## 18. گام بعدی (به‌روز)

1. **فاز ۰ + ۱ با هم** — بیشترین تغییر «شکل و شمایل» در shell است (نه فقط hex رنگ).
2. تأیید تو روی: radius 10px، motion 150–220ms، sidebar 17.5rem.
3. سپس dashboard به‌عنوان اولین صفحه محتوا.

```yaml
version: "2026-06-10-v2"
changelog: اضافه شدن Experience Layer — motion, interactions, shell reshape, enterprise scope
```

---

## 19. وضعیت پیاده‌سازی (بسته‌سازی 2026-06-10)

| فاز | وضعیت | شواهد |
|-----|--------|--------|
| ۰ Foundation | ✅ | `admin-skin.css`, `interactions.css`, `animations.css`, `body[data-workspace-plugin="denali"]`, seed `#0f766e` |
| ۱ Shell | ✅ | `operator-shell` 17.5rem sidebar, `operator-brand` Mountain + tagline, header blur, nav indicator |
| ۲ Dashboard | ✅ | `data-denali-animate`, KPI cards `data-denali-surface` |
| ۳ Tours + Wizard | ✅ | لیست/ویرایش + **Wizard Bridge** `/tours/new` — `docs/workspaces/denali/wizard-experience.md` |
| ۴–۶ صفحات | ✅ | Bookings/settings/finance/users — `data-denali-surface` روی کارت‌ها |
| ۷ Closure | ✅ | `SMK-P9-DENALI-THEME`, `SMK-P9-WIZARD-THEME`, `denali-admin-theme.spec.ts` (۸ تست), `denali-wizard-theme.spec.ts` (۸ تست) |

### تست‌ها

```bash
cd apps/web && NODE_ENV=test node --import tsx --import ./test/register-dom.mjs --test test/denali-admin-theme.spec.ts test/denali-wizard-theme.spec.ts
```

### معوق (اختیاری)

- `packages/workspaces/denali/theme/assets/logo-mark.svg` — فعلاً Lucide Mountain
- Header scroll shadow (`IntersectionObserver`)
- Snapshot Playwright بصری shell

```yaml
implementation_status: closed-for-phase-9
admin_estimate: "~98%"
wizard_estimate: "~98%"
```

## 20. بسته polish — 2026-06-10 (batch 1)

- [x] `DenaliSkeleton` + `data-denali-skeleton="shimmer"` در dashboard widgets
- [x] `DenaliEmptyState` + آیکن Mountain/Trees
- [x] Dashboard quick actions (`data-denali-quick-actions`)
- [x] Grid `2xl:grid-cols-4`
- [x] Sticky sidebar CTA (`data-operator-nav-cta`)
- [x] Sheet overlay `rgb(0 0 0 / 0.5)` برای Denali
- [x] `admin-experience.md` — scope selector + patterns table

## 21. بسته polish — batch 2 (2026-06-10)

- [x] فیلتر دسته تور (Denali) + `TourCategoryBadge` با `--denali-bark-600`
- [x] `BookingActivityTimeline` در پنل بازبینی رزرو
- [x] Inbox zebra + sticky header (`data-denali-bookings-inbox`)
- [x] `DenaliSkeleton` / `DenaliEmptyState` در tours + bookings
- [x] Focus ring سبز روی input/select/textarea
