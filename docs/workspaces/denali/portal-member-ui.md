# Denali portal member UI — Denali Pocket foundation

```yaml
doc_id: DENALI-PORTAL-MEMBER-UI
version: "2026-08-19-v6"
extends: portal-registration-ui.md · platform-portal-member-shell-architecture.mdoc
apps: [portal]
phase: DENALI-POCKET-3.4
```

## Scope

Visual layer for **authenticated member routes** (`/me/*`) inside `PortalMemberShell`. Business logic, entitlements, and BFF contracts unchanged.

**Out of scope:** login/register auth shell (see [portal-registration-ui.md](./portal-registration-ui.md)), marketing, operator admin, `/me/home` (3.3 locked), `/me/registrations` (3.2 locked), `/me/profile`.

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
| `portal/member-pages.css` | **3.3 Pocket home** + **3.2 Pocket trips list** + **3.4 Pocket trip detail** |
| `portal/member-profile.css` | Profile form + avatar |
| `portal/denali-form-controls.css` | Shared inputs + solid primary / outline secondary / text tertiary |
| `portal/login-page.css` | Auth experience (imports form controls) |
| `portal/alpine-login.css` | Denali `/login` Alpine Split only (`data-portal-login-full-page`) |
| `portal/registration-ledger.css` | Party Ledger registration (`/register`) — not member `/me` |
| `portal/marketing-header-parity.css` | Defeats marketing header layout; Pocket app-bar tokens |

Import order in `denali-portal.css`: semantic tokens → legacy inline rules → `login-page.css` → `registration-ledger.css` → `alpine-login.css` → member pack → desktop → **Pocket type override** after page pack so title/meta win over display headings. Form controls load via `@import` inside `login-page.css` and `member-profile.css`.

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
| `/me/profile` | `data-portal-member-profile` | `[data-portal-member-profile]` form, `[data-member-profile-save]` |
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

Trips list / detail / profile / more selectors must not pick up these rules except where they already shared a hook (`[data-portal-member-more]` keeps its own hero card).

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

## Verification

```bash
pnpm --filter @apps/portal test -- test/portal-visual-wave4.spec.ts test/portal-visual-wave5.spec.ts test/guest-theme-stack.spec.ts
```

Manual: 390px compact header + thumb bar (no glass pill); 768px same chrome; 1440px full-bleed rail, no floating card.
