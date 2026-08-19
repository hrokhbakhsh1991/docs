# Denali portal — visual regression matrix (PS-VIS-3)

**Purpose:** Stable `data-*` hooks for manual QA, Playwright, and future screenshot baselines.  
**Surfaces:** Portal guest app (`data-app-surface="portal"`) · Denali plugin (`data-workspace-plugin="denali"`).

## Shell chrome

| ID | Hook / selector | Surface | Wave |
|----|-----------------|---------|------|
| SH-01 | `[data-portal-shell-header]` + `[data-portal-member-header-minimal]` + brand/logo | Member shell | 1 |
| SH-01b | Portal member header CSS owned by `member-shell.css`; `denali-portal.css` must not import marketing header layout CSS | Compact 48–52px app bar | 3.1B |
| SH-02 | `[data-marketing-header-member]` (chip → profile; no header logout) | Member header identity | 1 / 5e |
| SH-02b | `[data-portal-shell-nav-footer]` `[data-public-auth-logout]` | Desktop side-rail logout | 5f |
| SH-02c | `[data-member-profile-session]` `[data-public-auth-logout]` | Mobile profile logout | 5f |
| SH-03 | `[data-portal-shell-bottom-nav]` + `[data-portal-shell-nav-icon]` | Bottom nav icons (incl. profile when entitled) | 2 |
| SH-05 | `[data-portal-shell-main]` mist Pocket canvas | Member shell page bg | 4 / Pocket 3.1 |
| SH-06 | `[data-portal-shell-user-menu]` profile chip + icon | Header user cluster | 4 |
| DESK-01 | `member-shell-desktop.css` `@media (min-width: 48rem)` body `:has([data-portal-shell])` | Desktop mist canvas | 5 / Pocket 3.1 |
| DESK-02 | `[data-portal-shell]:not([data-embedded-host])` full-viewport grid | Account app (no phone-card) | 5 / Pocket 3.1 |
| DESK-03 | Bottom nav `position: relative` inside shell (desktop) | Nav not full-bleed | 5 |
| DESK-04 | Home + trips stay one column `@media (min-width: 64rem)` | Page lists | 5 / Pocket 3.2–3.3 |
| DESK-05 | Shell `max-height: 100dvh` + main `overflow-y: auto` | In-app scroll | 5 / Pocket 3.1 |

## Registration (guest)

| ID | Hook / selector | Surface | Wave |
|----|-----------------|---------|------|
| REG-01 | `[data-portal-registration-chrome]` | Logo + back bar | 1 |
| REG-02 | `[data-registration-stepper]` + `[data-registration-step-state]` | Step indicator | 2 |
| REG-RES-01 | `[data-registration-stepper-mode="intake-only"]` | Member resume — single intake step | 4 |
| REG-03 | `[data-public-registration-flow]` | Active step body | — |
| LOGIN-01 | `[data-portal-auth-backdrop]` + `[data-portal-auth-card]` + `[data-portal-auth-hero]` | Login + catalog register auth shell | 4 |

## Member modules

| ID | Hook / selector | Surface | Wave |
|----|-----------------|---------|------|
| MEM-HOME-01 | `main[data-portal-member-home]` + `[data-portal-member-home-quick-links]` | Home | 4 / 3.3 |
| MEM-HOME-02 | `[data-portal-member-home-quick-link-icon]` | Next-action / secondary rows | 4 / 3.3 |
| MEM-HOME-05 | Pocket home: canvas title, no hero gradient, first shortcut is next action | `/me/home` only | 3.3 |
| MEM-TRIP-01 | `[data-portal-member-registration-row]` + status badge | Trips list | 2 |
| MEM-TRIP-03 | `[data-portal-member-registrations-list]` + `[data-portal-member-row-chevron]` | Trips list affordance | 4 |
| MEM-TRIP-05 | Pocket trips list: canvas title, no hero gradient, single-column rows | `/me/registrations` only | 3.2 |
| MEM-TRIP-04 | `[data-portal-member-detail-app-bar]` + `[data-portal-member-detail-hero]` | Trip detail | 4 |
| MEM-TRIP-02 | `[data-portal-member-registrations-empty-cta]` | Empty → marketing `/tours` | 3 |
| MEM-WALLET-01 | `main[data-portal-member-module-stub][data-portal-member-module-id="wallet"]` | Hidden wallet stub | 3 |
| MEM-MORE-01 | `main[data-portal-member-more]` + `[data-portal-member-hub-link-icon]` | More hub list | 5 |
| MEM-STUB-01 | `[data-portal-member-stub-back]` | Module stub back CTA | 5 |
| MEM-PROF-01 | `main[data-portal-member-profile]` | Profile form | — |
| MEM-PROF-02 | `[data-member-profile-field="gender"] select` | Gender select (SDK enum) | — |

## Token parity (D1)

| ID | Check | Expected |
|----|-------|----------|
| TOK-01 | `portal-semantic-tokens.css` `--denali-forest-600` | `#059669` |
| TOK-02 | `denali-token-bridge` `--ws-color-primary` | `#059669` |
| TOK-03 | `admin-semantic-tokens.css` `--denali-forest-600` | `#059669` |

## Smoke URLs (local dev)

| Page | URL |
|------|-----|
| Register | `http://denali.portal.localhost:3003/catalog/00000000-0000-4000-8000-000000000220/register` |
| Login | `http://denali.portal.localhost:3003/login` |
| Home | `http://denali.portal.localhost:3003/me/home` |
| Trips | `http://denali.portal.localhost:3003/me/registrations` |
| Wallet (grant required) | `http://denali.portal.localhost:3003/me/wallet` |

## Automated coverage

| Spec | IDs |
|------|-----|
| `apps/portal/test/portal-visual-wave1.spec.ts` | REG-01, SH-01, SH-02 |
| `apps/portal/test/portal-visual-wave2.spec.ts` | REG-02, SH-03 |
| `apps/portal/test/portal-visual-wave3.spec.ts` | MEM-TRIP-02, MEM-WALLET-01, TOK hooks |
| `apps/portal/test/portal-visual-wave4.spec.ts` | SH-05/06, MEM-HOME-02, MEM-TRIP-03/04, VIS-FORM-01, MEM-MORE-01, MEM-STUB-01 |
| `apps/portal/test/portal-visual-wave5.spec.ts` | DESK-01..04 desktop frame + auth layout |
| `apps/portal/test/guest-theme-stack.spec.ts` | TOK-01 skin import |
| `apps/marketing/test/resolve-app-locale.spec.ts` | GX-1 (`MKT-GX-01`) |
| `apps/marketing/test/marketing-shell-nav.spec.ts` | GX-1 shell wiring (`MKT-GX-02`) |
| `apps/portal/tests/e2e/portal-shell-visual.spec.ts` | SH-01 baseline · DESK-02 desktop frame (`SMK-PTL-VIS-02`, 1280×800) |
| `apps/portal/tests/e2e/portal-member-profile-smoke.spec.ts` | DEN-PROF-01..05, MEM-PROF-02 |
| `scripts/guards/guard-public-catalog-m17.mjs` | TOK-01/02 DTCG guest semantic primary |
