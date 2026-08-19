# Denali portal member UI — Denali Pocket foundation

```yaml
doc_id: DENALI-PORTAL-MEMBER-UI
version: "2026-08-19-v8"
extends: portal-registration-ui.md · platform-portal-member-shell-architecture.mdoc
apps: [portal]
phase: DENALI-POCKET-4
```

## Scope

Visual layer for **authenticated member routes** (`/me/*`) inside `PortalMemberShell`. Business logic, entitlements, and BFF contracts unchanged.

**Out of scope:** login/register auth shell (see [portal-registration-ui.md](./portal-registration-ui.md)), marketing, operator admin. Page IA for 3.2–3.5 is **locked** — Phase 4 only flattens leftover chrome so every `/me` surface shares one Pocket language.

## Design intent (Denali Pocket)

Premium **mobile-first customer app**, not a marketing site inside a portal.

| Principle | Implementation |
| --------- | -------------- |
| App frame | Compact sticky header (48–52px) + mist canvas + fixed thumb bar; content scrolls in `[data-portal-shell-main]` |
| Material | Mist page (`--color-bg-page`) · white surfaces · forest primary · alpine **only** for attention/action (not chrome wash) |
| Type | FA Vazirmatn / EN Inter. Title 1.25rem / 650. Body 0.9375rem. Meta 0.8125rem. Nav 0.75rem / 600. No display/Calistoga on `/me/*` |
| Elevation | One shadow (`--denali-shadow-card`). No glass stack, no decorative orbs, no gradient CTAs |
| Thumb zone | Nav links min 44px; primary CTA 48px / 12px radius / solid forest |
| Hook-only skin | Workspace CSS on `data-*`; no Tailwind in `packages/workspaces/denali/theme/` |

## CSS files (L3)

| File | Owns |
| ---- | ---- |
| `portal/member-shell.css` | Pocket chrome — canvas, compact header, thumb bar, type cascade |
| `portal/member-shell-desktop.css` | Full-viewport account app + side rail (no floating phone-card) |
| `portal/member-pages.css` | **3.3 Pocket home** + **3.2 Pocket trips list** + **3.4 Pocket trip detail** + **4 More hub / stubs** |
| `portal/member-profile.css` | **3.5 Pocket profile** — canvas title, grouped account sections, quiet session |
| `portal/denali-form-controls.css` | Shared inputs + solid primary / outline secondary / text tertiary |
| `portal/login-page.css` | Auth experience (imports form controls) |
| `portal/alpine-login.css` | Denali `/login` Alpine Split only (`data-portal-login-full-page`) |
| `portal/registration-ledger.css` | Party Ledger registration (`/register`) — not member `/me` |

Import order in `denali-portal.css`: semantic tokens → legacy inline rules → `login-page.css` → `registration-ledger.css` → `alpine-login.css` → member pack → desktop → **Pocket type override** after page pack so title/meta win over display headings. Form controls load via `@import` inside `login-page.css` and `member-profile.css`.

### Header CSS ownership (3.1B)

Member `/me/*` app bar is **portal-owned**. Marketing header layout CSS must not load on the portal surface.

| Pack | Owner | Surfaces |
| ---- | ----- | -------- |
| `marketing/shell.css` | Marketing header layout (sticky glass bar, inner padding, 2-col then desktop 3-col) | `denali-marketing.css` only |
| `marketing/components/34-mkt-header-member.css` | Marketing member chip (tinted glass, hover lift) | `denali-marketing.css` only |
| `marketing/components/35-mkt-header-desktop.css` | Marketing ≥1024px centered nav + toolbar | `denali-marketing.css` only |
| `portal/member-shell.css` | Compact 48–52px app bar: brand \| profile chip. Solid surface. No glass, no center nav, no locale, no header logout | authenticated `[data-portal-shell]` only |
| `portal/member-shell-desktop.css` | Side rail + full-viewport grid; header stays compact (extra inline padding only) | `/me/*` at `≥48rem`, non-embedded |

`denali-portal.css` must **not** `@import` `marketing/shell.css`, `34-mkt-header-member.css`, `35-mkt-header-desktop.css`, or a parity shim that re-imports them.

Markup may keep `data-marketing-header*` hooks for contracts/tests. Visual ownership is the portal member shell, not marketing cascade.

Height contract: `[data-portal-shell-header]` `height` / `min-height` / `max-height` = `--portal-pocket-header-height` (3.25rem / 52px), `box-sizing: border-box`, `padding: 0`. This overrides L2 `fallback-guest-portal-shell.css` (`min-height: 3.5rem` + `padding: var(--space-3) var(--space-4)`), which otherwise inflates the bar to ~77–79px even when the inner row is 52px. Inner `[data-marketing-header-inner]` is a 2-column grid with `padding-block: 0`. Interactive brand + chip `min-height: 44px` (`--portal-pocket-touch`).

Desktop: [portal-member-desktop-frame.md](./portal-member-desktop-frame.md) — full-bleed rail + mist canvas at `≥48rem`. Embedded hosts keep mobile chrome.

## Shell hooks

| Hook | Purpose |
| ---- | ------- |
| `[data-portal-shell]` | Root frame (platform) |
| `[data-portal-shell-header]` | Sticky app bar (52px Pocket) |
| `[data-portal-shell-main]` | Scrollable content + mist canvas |
| `[data-portal-shell-bottom-nav]` | Primary tab bar |
| `[data-portal-shell-nav-link][data-active="true"]` | Active tab — forest color, no glass pill |
| `[data-portal-shell-user-menu]` | Profile + logout cluster (legacy hook) |

## Page hooks

| Route | `main` marker | Sections |
| ----- | ------------- | -------- |
| `/me/home` | `data-portal-member-home` | Canvas `[data-portal-member-page-header]`, `[data-portal-member-home-quick-links]` (`li:first-child` = next action) |
| `/me/registrations` | `data-portal-member-registrations` | `[data-portal-member-registration-row]`, `[data-portal-member-row-chevron]` |
| `/me/registrations/[id]` | `data-portal-member-registration-detail` | Canvas `[data-portal-member-detail-app-bar]` + `[data-portal-member-detail-hero]` (hero hook kept; no gradient card) |
| `/me/profile` | `data-portal-member-profile` | Canvas `[data-portal-member-page-header]`, `[data-member-profile-card]`, `[data-member-profile-save]`, `[data-member-profile-session]` |
| `/me/more` | `data-portal-member-more` | `[data-portal-member-hub-list]`, `[data-portal-member-hub-link-icon]` |
| Module stub | `data-portal-member-module-stub` | `[data-portal-member-module-stub-card]`, `[data-portal-member-stub-back]` |

## Smoke URLs

| Page | URL |
| ---- | --- |
| Home | `http://denali.portal.localhost:3003/me/home` |
| Trips | `http://denali.portal.localhost:3003/me/registrations` |
| Profile | `http://denali.portal.localhost:3003/me/profile` |
| More | `http://denali.portal.localhost:3003/me/more` |

## Home (3.3 — `/me/home` only)

Customer-app home answers **“What should I do next?”** — not “What modules exist?”. Visual reference: 3.2 trips list (canvas title, compact hierarchy, one obvious action). **No** invented trip, payment, or profile facts.

| Rule | Implementation |
| ---- | -------------- |
| Canvas title | `[data-portal-member-page-header]` sits on mist. No hero card, no gradient, no orb `::after` |
| Inset | Shell already pads `--space-4` (16px). Home `main` is `width: 100%` — do not wrap the page in a second card |
| Type | Title 1.25rem / 650. Lede is meta (`0.8125rem`), not a marketing paragraph |
| Next action | First entitled shortcut (`li:first-child`) is a compact solid `--color-primary` bar (`min-height: 3rem`, 12px radius, label + chevron). Same `href` / `data-testid` / icon hook as before. Description is not painted on the CTA |
| Secondary | Remaining shortcuts are compact hairline rows (label + meta + chevron), **not** 10rem tiles and **not** a second tab bar |
| Quiet chrome | Section heading, eyebrow pill, and “Recommended” badge are not painted. Page title + lede carry the next-action copy. Arrow `↗` becomes a chevron on secondary rows |
| Desktop | Single column (not a 2/3-col card grid) |

Hooks unchanged: `[data-portal-member-home]`, `[data-portal-member-home-lede]`, `[data-portal-member-home-quick-links]`, `[data-portal-member-home-quick-link-icon]`, `data-testid="portal-home-link-{id}"`. BFF `buildMemberHomePayload` unchanged.

Trips list / detail / more selectors must not pick up these rules except where they already shared a hook (`[data-portal-member-more]` keeps its own hero card). Profile (3.5) uses the same canvas-title pattern under `main[data-portal-member-profile]`.

## Trips list (3.2 — `/me/registrations` only)

Airline **My Trips** scanning + Stripe quiet meta + Denali Pocket material. **Not** a card dashboard.

| Rule | Implementation |
| ---- | -------------- |
| Canvas title | `[data-portal-member-page-header]` sits on mist (`--color-bg-page`). No hero card, no gradient, no orb `::after` |
| Inset | Shell already pads `--space-4` (16px). Trips `main` is `width: 100%` — do not wrap the page in a second card |
| Type | Title 1.25rem / 650 (Pocket override). Lede is meta (`0.8125rem`), not a marketing paragraph |
| Filters | Segmented text tabs on a hairline; 44px touch; count is text, not a chip tray |
| Rows | One white surface, hairline, 12px radius, one shadow. Tour title + **one** status label + date/payment meta + chevron. Self/other is meta text, not a second chip |
| Empty | Calm copy + solid forest CTA (`min-height: 3rem`). No radial wash, no gradient button |
| Desktop | Single-column list (not a 2-col card grid). Slightly more inline padding at `≥48rem` |

Hooks unchanged: `[data-portal-member-registrations]`, filter tabs, `[data-portal-member-registration-row]`, status/payment/departure, chevron, empty-state.

## Trip detail (3.4 — `/me/registrations/[id]` only)

Customer trip page: **open → status → next action**. Visual reference: 3.2 list + 3.3 canvas. **Not** a KPI dashboard. Receipt upload, intake amend, and payment states stay the same hooks and flows.

| Order | Surface |
| ----- | ------- |
| 1 | Compact back (`[data-portal-member-detail-app-bar]`) — text, 44px, no pill |
| 2 | Canvas title — tour name on mist. Eyebrow pill not painted. Lede is meta |
| 3 | Status stack (`[data-portal-member-detail-kpis]`) — label + value rows, one column, no KPI cards |
| 4 | Next action — existing receipt panel (upload / awaiting / waiting / paid / waived / closed) as one white hairline surface |
| 5 | Secondary — intake amend, same form, no nested marketing cards |

| Rule | Implementation |
| ---- | -------------- |
| Canvas | `[data-portal-member-detail-hero]` is not a card: `background: none`, no gradient, no orb `::before` |
| Inset | Detail `main` is `width: 100%`. Shell already pads 16px |
| Type | Title 1.25rem / 650. KPI labels meta. Status is text, not a chip tray |
| Next action | One solid `--color-primary` CTA (`min-height: 3rem`) where a primary action already exists. Secondary links are outline/text. No gradient buttons |
| Panels | Receipt + intake: white surface, hairline, 12px radius, one shadow. No decorative bars. Copy start-aligned, not a centered empty-state poster |
| Desktop | Single column (not hero + KPI 2-col grid) |

Hooks unchanged: app-bar, back, hero, KPIs, guest badge, `[data-portal-member-receipt-*]`, `[data-portal-member-intake-amend]`. BFF + mutations unchanged.

## Profile (3.5 — `/me/profile` only)

Calm **customer account** page. Visual reference: iOS Settings grouping + Stripe/Vercel account clarity + Pocket material (3.1–3.4). **Not** a marketing settings dashboard.

| Order | Surface |
| ----- | ------- |
| 1 | Canvas title on mist — account name + meta lede. No hero card, no gradient, no orb |
| 2 | Identity — avatar + name as a quiet grouped row (preview + upload/remove). Same avatar BFF |
| 3 | Sections — identity / participant as white hairline groups (one shadow). Desktop flattens to sectioned dividers (PS-VIS-5g) |
| 4 | Save — sticky full-width solid `--color-primary` (`min-height: 3rem`). Discard stays hidden on mobile, visible on desktop |
| 5 | Session — quiet logout row (`[data-member-profile-session]`). Outline `--destructive` control. Desktop still hides this; rail footer owns sign-out |

| Rule | Implementation |
| ---- | -------------- |
| Canvas | `[data-portal-member-page-header]` is not a card: `background: none`, no gradient, no orb `::after` |
| Inset | Profile `main` is a column on mist. Shell already pads 16px |
| Type | Title 1.25rem / 650. Lede is meta (`0.8125rem`) |
| Groups | `[data-member-profile-card]`: white surface, hairline, 12px radius, one `--denali-shadow-card`. No nested field boxes, no legend dots, no photo orb |
| Mobile change | Same OTP flow; hairline inset, not a tinted gradient panel |
| Save | `[data-member-profile-actions]` sticky in the thumb zone. Solid forest CTA. No gradient tray, no glass blur |
| Session | Same hooks + `data-public-auth-logout`. Not a danger-wash card |
| Desktop | `data-member-profile-layout="sectioned"`: 2-col field grid, horizontal avatar, Discard + Save row, session hidden |

Hooks unchanged: page header, form `data-member-profile-layout="sectioned"`, cards, avatar, mobile-change, save/discard, session. Profile GET/PATCH, OTP, avatar upload, logout, validation, and form state unchanged.

## Phase 4 — final visual audit

Cross-page check after 3.1B–3.5. **No new UX.** Skin only. Login / register stay Alpine/Ledger.

| Surface | 3.x status | Phase 4 finding | Polish |
| ------- | ---------- | --------------- | ------ |
| Shell header / thumb / rail | 3.1B locked | Compact 52px + mist + forest active tab | Rail logout hex fallback `#b42318` → `--destructive` |
| `/me/home` | 3.3 locked | Canvas title + next-action bar | None |
| `/me/registrations` | 3.2 locked | Canvas title + hairline rows | None |
| `/me/registrations/[id]` | 3.4 locked | Canvas title + stacked status | Receipt error token `--color-danger` → `--destructive` |
| `/me/profile` | 3.5 locked | Canvas title + grouped account | None |
| `/me/more` | leftover | Gradient hero, eyebrow pills, 5rem gradient tiles | Canvas title, hide eyebrows, compact hairline rows |
| Module stub / unauthorized | leftover | Orb poster + gradient back CTA | Quiet surface + solid `--color-primary` (`min-height: 3rem`) |

Shared type: every `[data-portal-member-page-header] > p` uses meta (`0.8125rem`), matching home/trips/detail/profile ledes.

Hooks unchanged on more/stub: `[data-portal-member-more]`, hub list/icon/description/count/eyebrow (eyebrow not painted), `[data-portal-member-stub-back]`.

## Verification

```bash
pnpm --filter @apps/portal test -- test/portal-visual-wave4.spec.ts test/portal-visual-wave5.spec.ts test/guest-theme-stack.spec.ts
```

Manual: 390px compact header + thumb bar (no glass pill); 768px same chrome; 1440px full-bleed rail, no floating card.
