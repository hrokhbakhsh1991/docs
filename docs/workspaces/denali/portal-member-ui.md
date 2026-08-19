# Denali portal member UI — Denali Pocket foundation

```yaml
doc_id: DENALI-PORTAL-MEMBER-UI
version: "2026-08-19-v2"
extends: portal-registration-ui.md · platform-portal-member-shell-architecture.mdoc
apps: [portal]
phase: DENALI-POCKET-3.1
```

## Scope

Visual layer for **authenticated member routes** (`/me/*`) inside `PortalMemberShell`. Business logic, entitlements, and BFF contracts unchanged.

**Out of scope:** login/register auth shell (see [portal-registration-ui.md](./portal-registration-ui.md)), marketing, operator admin, page-module layout (home cards, trip rows — later Pocket slices).

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
| `portal/member-pages.css` | Home, trips list, trip detail, empty states (page pack — not 3.1) |
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
| `/me/home` | `data-portal-member-home` | `[data-portal-member-page-header]`, `[data-portal-member-home-quick-links]` |
| `/me/registrations` | `data-portal-member-registrations` | `[data-portal-member-registration-row]`, `[data-portal-member-row-chevron]` |
| `/me/registrations/[id]` | `data-portal-member-registration-detail` | `[data-portal-member-detail-app-bar]`, `[data-portal-member-detail-hero]` |
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

## Verification

```bash
pnpm --filter @apps/portal test -- test/portal-visual-wave4.spec.ts test/portal-visual-wave5.spec.ts test/guest-theme-stack.spec.ts
```

Manual: 390px compact header + thumb bar (no glass pill); 768px same chrome; 1440px full-bleed rail, no floating card.
