# Denali — Member portal home (`/me/home`)

**Track:** PS-M1 · **Status:** Visual polish (Wave 3 · 2026-07-12)

## IA contract

| Item | Value |
|------|-------|
| Module id | `home` — **platform-owned** (DL-30); workspaces MUST NOT declare `home` in `memberPortal.modules` |
| Denali contract | `includePlatformHome: true` via preset `guest-full-v1` |
| Route | `/me/home` — static page wins over `[...modulePath]` dispatcher |
| Bottom nav | Primary tier when `member.module.home` granted |
| Default landing | `/me` redirects to home when entitled, else default primary module (`trips`) |

## Data hooks

| Hook | Purpose |
|------|---------|
| `main[data-portal-member-home]` | Page root |
| `data-portal-member-home-lede` | Welcome subtitle |
| `data-portal-member-home-quick-links` | Entitled shortcuts — **primary** + **user_menu** modules (excludes `home`; e.g. trips + profile) |
| `data-testid="portal-home-link-{moduleId}"` | Per-module quick link |

## BFF

`buildMemberHomePayload` (`apps/portal/src/me/member-home-bff.server.ts`) — welcome copy keys + entitled **primary** and **user_menu** modules from registry ∩ entitlements (PS-5 · 2026-07-12: profile shortcut on home).

## Discoverability (profile)

| Surface | Profile link |
| ------- | ------------- |
| Header user menu | `user_menu` tier — always when entitled |
| Bottom nav | Appended after primary tabs when combined count ≤ 5 (same `user_menu` modules) |
| Home quick links | Entitled `user_menu` modules (e.g. profile card) |

## Visual (Denali Pocket 3.3)

Home is a **next-action canvas**, not a marketing welcome with module tiles. See [portal-member-ui.md](./portal-member-ui.md) and [portal-visual-regression.md](./portal-visual-regression.md) **MEM-HOME-05**.

| Rule | Skin |
| ---- | ---- |
| Title | On mist. No gradient hero card |
| First entitled shortcut | Compact solid primary bar (`li:first-child`, label + chevron) — “what should I do next?” |
| Remaining shortcuts | Compact hairline rows with chevron. Not 10rem tiles. Not a duplicate of the thumb bar |
| Data | Same BFF modules + i18n keys. No invented trip/payment/profile facts |

## Related

- [portal-member-registrations.md](./portal-member-registrations.md)
- [platform-portal-member-shell-architecture.mdoc](../../phase-19/platform-portal-member-shell-architecture.mdoc) § platform-owned modules
