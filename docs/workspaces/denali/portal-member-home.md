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
| `data-portal-member-home-quick-links` | Entitled module shortcuts (excludes `home`) |
| `data-testid="portal-home-link-{moduleId}"` | Per-module quick link |

## BFF

`buildMemberHomePayload` (`apps/portal/src/me/member-home-bff.server.ts`) — welcome copy keys + entitled modules from registry ∩ entitlements.

## Visual (PS-VIS)

Quick links render as card rows (starter base + Denali skin). See [portal-visual-regression.md](./portal-visual-regression.md) row **MEM-HOME-01**.

## Related

- [portal-member-registrations.md](./portal-member-registrations.md)
- [platform-portal-member-shell-architecture.mdoc](../../phase-19/platform-portal-member-shell-architecture.mdoc) § platform-owned modules
