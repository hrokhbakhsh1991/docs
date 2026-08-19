# Denali portal member — desktop frame (Denali Pocket)

```yaml
doc_id: DENALI-PORTAL-MEMBER-DESKTOP
version: "2026-08-19-v8"
extends: portal-member-ui.md
phase: DENALI-POCKET-3.4
```

## Problem

Mobile-first member shell is the authority. Earlier PS-VIS-5 **phone card** (`max-width: 64rem`, `max-height: calc(100dvh - 2rem)`, alpine stage, rounded floating window) made desktop feel like a marketing lightbox, not an account app. Marketing-parity header (center nav + locale + drawer) duplicated the side rail. Header **Log out** next to the member chip cluttered identity chrome.

## Solution (Denali Pocket shell · PS-VIS-5e header · 5f logout · 5g sectioned profile)

### A. Desktop app shell (all `/me/*`)

At `≥48rem` (non-embedded):

| Element | Behavior |
| ------- | -------- |
| Shell | **Full-viewport account app** (`min-height` / `max-height: 100dvh`, no centered phone-card, no alpine stage). Mist canvas. |
| Header (**PS-VIS-5e / 3.1B**) | **Compact app bar (48–52px), portal-owned CSS:** brand → marketing home · member chip → `/me/profile`. **No** locale, **no** center nav, **no** logout in the header. No marketing glass/blur. Marketing header CSS (`shell.css`, `34-mkt-header-member`, `35-mkt-header-desktop`) is marketing-only. |
| Nav | **Side rail** — `[data-portal-shell-bottom-nav]` vertical; thumb bar on mobile |
| Logout (**PS-VIS-5f**) | **Desktop:** pinned footer of the side rail (`[data-portal-shell-nav-footer]`). **Mobile:** account session card on `/me/profile` (`[data-member-profile-session]`); nav footer hidden so the thumb bar stays for primary destinations only. |
| Main | Scrolls in the content column (`overflow-y: auto`) |

**Dual-app rule:** Marketing owns discover nav; Portal header is identity + egress to marketing brand only. Sign-out is an account action, not header chrome.

Embedded hosts (`data-embedded-host`) keep mobile chrome.

### B. Profile settings (PS-VIS-5g sectioned)

Inspired by Linear / Vercel account settings and [shadcn Field](https://ui.shadcn.com/docs/forms/react-hook-form) rhythm — **not** stacked bordered cards:

| Mobile `<48rem` | Desktop `≥48rem` |
| --------------- | ---------------- |
| Centered avatar + sticky Save (cards OK) | **Sectioned form**: hairline dividers, no nested card boxes |
| Single column fields | 2-column field grid; mobile OTP full-span |
| Sticky full-width Save | **Actions footer**: Discard + Save, end-aligned |

Hooks:

- `data-member-profile-layout="sectioned"` — desktop skin contract
- `data-member-profile-card` — section hooks (E2E); flattened on desktop
- `data-member-profile-actions` — footer row
- `data-member-profile-discard` — reset dirty fields
- `data-member-profile-session` — mobile logout card (hidden on desktop; rail footer owns sign-out)
- Existing `data-member-profile-save` / avatar / field hooks unchanged for smoke

**Non-goals:** full shadcn Sidebar package, second settings nav inside profile, dashboard density for home or trips list, L2 platform shell rewrite.

## Breakpoints

| Viewport | Shell | Nav | Profile |
| -------- | ----- | --- | ------- |
| `< 48rem` | full-bleed Pocket mobile | bottom bar | save + cards |
| `≥ 48rem` | 100dvh account app + side rail | vertical rail | **sectioned** profile (5g) |
| `≥ 64rem` | wider rail (14rem) | vertical rail | wider sectioned form (~52rem) |

## CSS / markup files

| File | Scope |
| ---- | ----- |
| `portal/member-shell.css` | **3.1B compact app bar** (height lock, 2-col inner, brand + chip). Marketing header CSS not imported. |
| `portal/member-shell-desktop.css` | Mist canvas, full-viewport grid, **side-rail nav**; header padding only — never restores marketing 3-col nav |
| `portal/member-pages-desktop.css` | **Home + trips + trip detail stay one column** (Pocket 3.3 / 3.2 / 3.4) |
| `portal/member-profile.css` | Mobile cards + **PS-VIS-5g sectioned** desktop |
| `src/shell/portal-member-header.tsx` | **PS-VIS-5e** brand + chip (`data-marketing-header*` hooks retained) |
| `src/shell/portal-member-bottom-nav.tsx` | Primary nav + **PS-VIS-5f** desktop logout footer. **BUG-2:** labels come from RSC props (`item.label`, `primaryNavLabel`, logout strings) — no `useTranslations` in this client file. |
| `app/me/profile/member-profile-form.tsx` | Hooks + `data-member-profile-layout`; mobile session/logout |

## Verification

```bash
node --import ./test/css-hook.mjs --import tsx --test \
  test/portal-visual-wave5.spec.ts test/portal-visual-wave4.spec.ts test/guest-theme-stack.spec.ts
```

Manual: 1440×900 — side rail visible, **no floating phone-card**, mist canvas; profile **sectioned**; 390px compact header + thumb bar.
