# Denali portal member — desktop frame (PS-VIS-5 → 5f)

```yaml
doc_id: DENALI-PORTAL-MEMBER-DESKTOP
version: "2026-07-17-v6"
extends: portal-member-ui.md
phase: PS-VIS-5g
```

## Problem

Mobile-first member shell looks correct on phones. The PS-VIS-5 **phone card** and later **marketing-parity header** (center nav + locale + drawer) duplicated the side rail and broke desktop layout (tall header, stacked center links, FA/EN). Header **Log out** next to the member chip also felt like chrome clutter, not an intentional account action.

## Solution (PS-VIS-5c shell · 5e header · 5f logout · 5g sectioned profile)

### A. Desktop app shell (all `/me/*`)

At `≥48rem` (non-embedded):

| Element | Behavior |
| ------- | -------- |
| Shell | Wide page card (`max-width: 64rem` → `72rem` at `≥64rem`), centered on alpine backdrop |
| Header (**PS-VIS-5e**) | **Minimal chrome only:** brand → marketing home · member chip → `/me/profile`. **No** locale, **no** center nav, **no** logout in the header. |
| Nav | **Side rail** — `[data-portal-shell-bottom-nav]` vertical; thumb bar on mobile |
| Logout (**PS-VIS-5f**) | **Desktop:** pinned footer of the side rail (`[data-portal-shell-nav-footer]`). **Mobile:** account session card on `/me/profile` (`[data-member-profile-session]`); nav footer hidden so the thumb bar stays for primary destinations only. |
| Main | Scrolls in the content column |

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

**Non-goals:** full shadcn Sidebar package, second settings nav inside profile, dashboard density for trips list, L2 platform shell rewrite.

## Breakpoints

| Viewport | Shell | Nav | Profile |
| -------- | ----- | --- | ------- |
| `< 48rem` | 36rem mobile | bottom bar | sticky save + cards |
| `≥ 48rem` | 64rem page + side rail | vertical rail | **sectioned** profile (5g) |
| `≥ 64rem` | 72rem | vertical rail | wider sectioned form (~52rem) |

## CSS / markup files

| File | Scope |
| ---- | ----- |
| `portal/member-shell-desktop.css` | Backdrop, page shell, **side-rail nav** |
| `portal/member-pages-desktop.css` | Home/trips grids |
| `portal/member-profile.css` | Mobile cards + **PS-VIS-5g sectioned** desktop |
| `portal/marketing-header-parity.css` | Minimal header skin tokens (brand + chip) |
| `src/shell/portal-member-header.tsx` | **PS-VIS-5e** brand + chip |
| `src/shell/portal-member-bottom-nav.tsx` | Primary nav + **PS-VIS-5f** desktop logout footer |
| `app/me/profile/member-profile-form.tsx` | Hooks + `data-member-profile-layout`; mobile session/logout |

## Verification

```bash
node --import ./test/css-hook.mjs --import tsx --test \
  test/portal-visual-wave5.spec.ts test/portal-visual-wave4.spec.ts test/guest-theme-stack.spec.ts
```

Manual: 1440×900 — side rail visible, profile **sectioned** (no stacked card boxes), Save in footer; 390px cards unchanged.
