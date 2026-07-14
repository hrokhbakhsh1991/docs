# Denali portal member — desktop frame (PS-VIS-5)

```yaml
doc_id: DENALI-PORTAL-MEMBER-DESKTOP
version: "2026-07-14-v1"
extends: portal-member-ui.md
phase: PS-VIS-5
```

## Problem

Mobile-first member shell (`max-width: 36rem`) looks correct on phones. On desktop:

- Bottom nav is `position: fixed` full viewport width while content is a narrow column.
- Side margins show flat `body` background while `main` has alpine gradient (banding).
- Auth routes (`/login`, register) use full-viewport backdrop; `/me/*` does not.

## Solution: Centered App Frame

Same mobile IA (bottom nav, thumb zone). At `≥48rem`, render the shell as a centered card on a full-viewport alpine backdrop. Bottom nav is **contained inside the frame**, not full-bleed.

**Non-goals:** Sidebar nav, stretching content to 1200px, L2 platform changes in phase 1.

## Breakpoints

| Viewport | Shell max-width | Home quick links | Trips list |
| -------- | --------------- | ---------------- | ---------- |
| `< 48rem` | 36rem (mobile — unchanged) | 2 columns | 1 column |
| `≥ 48rem` | 32rem frame + shadow | 2 columns | 1 column |
| `≥ 64rem` | 40rem frame | 3 columns | 2 columns |

## CSS files

| File | Scope |
| ---- | ----- |
| `portal/member-shell-desktop.css` | Body backdrop (`:has([data-portal-shell])`), frame, nav containment |
| `portal/member-pages-desktop.css` | Page grids at `≥64rem` |
| `portal/login-page.css` | `@media` block for auth layout widening |

## Hooks

| Hook | When |
| ---- | ---- |
| `[data-portal-shell]` | Frame target (no TSX change) |
| `[data-portal-shell][data-embedded-host]` | **Excluded** — Telegram/embedded keeps mobile fixed nav |

## Verification

```bash
pnpm --filter @apps/portal test -- test/portal-visual-wave5.spec.ts test/guest-theme-stack.spec.ts
```

Manual: 1280×800 — nav width equals shell; main scrolls inside frame; 375px unchanged.

### In-frame scroll (≥48rem)

Shell `max-height: calc(100dvh - 2rem)`; `[data-portal-shell-main]` scrolls with `overflow-y: auto` so long trips/profile lists do not stretch the card indefinitely.
