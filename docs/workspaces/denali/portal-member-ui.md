# Denali portal member UI — mobile-first skin

```yaml
doc_id: DENALI-PORTAL-MEMBER-UI
version: "2026-07-14-v1"
extends: portal-registration-ui.md · platform-portal-member-shell-architecture.mdoc
apps: [portal]
phase: PS-VIS-4
```

## Scope

Visual layer for **authenticated member routes** (`/me/*`) inside `PortalMemberShell`. Business logic, entitlements, and BFF contracts unchanged.

**Out of scope:** login/register auth shell (see [portal-registration-ui.md](./portal-registration-ui.md)), marketing, operator admin.

## Design intent (mobile-first)

| Principle | Implementation |
| --------- | -------------- |
| App frame | Fixed bottom nav + sticky header; content scrolls in `[data-portal-shell-main]` |
| Denali continuity | Alpine muted page canvas + glass cards (lighter than auth backdrop) |
| Thumb zone | CTAs min-height 3rem; bottom nav safe-area; save bar above nav |
| Hook-only skin | Workspace CSS on `data-*`; no Tailwind in `packages/workspaces/denali/theme/` |

## CSS files (L3)

| File | Owns |
| ---- | ---- |
| `portal/member-shell.css` | Shell chrome — header, bottom nav, page canvas |
| `portal/member-pages.css` | Home, trips list, trip detail, empty states |
| `portal/member-profile.css` | Profile form + avatar (parity with auth form controls) |
| `portal/denali-form-controls.css` | Shared inputs + primary CTA (auth card, profile, receipt) |
| `portal/login-page.css` | Auth experience (imports form controls) |

Import order in `denali-portal.css`: semantic tokens → legacy inline rules → `login-page.css` → member pack → **desktop** (`member-shell-desktop`, `member-pages-desktop`). Form controls load via `@import` inside `login-page.css` and `member-profile.css`.

Desktop frame: [portal-member-desktop-frame.md](./portal-member-desktop-frame.md) — centered shell card `≥48rem`, nav contained, body backdrop via `:has([data-portal-shell])`.

## Shell hooks

| Hook | Purpose |
| ---- | ------- |
| `[data-portal-shell]` | Root frame (platform) |
| `[data-portal-shell-header]` | Sticky app bar |
| `[data-portal-shell-main]` | Scrollable content + alpine canvas |
| `[data-portal-shell-bottom-nav]` | Primary tab bar |
| `[data-portal-shell-nav-link][data-active="true"]` | Active tab pill |
| `[data-portal-shell-user-menu]` | Profile + logout cluster |

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
pnpm --filter @apps/portal test -- test/portal-visual-wave4.spec.ts test/guest-theme-stack.spec.ts
```

Manual (375px viewport): no horizontal scroll; active tab visible; trips cards tappable; profile save full-width above bottom nav.
