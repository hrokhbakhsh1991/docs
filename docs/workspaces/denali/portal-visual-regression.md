# Denali portal — visual regression matrix (PS-VIS-3)

**Purpose:** Stable `data-*` hooks for manual QA, Playwright, and future screenshot baselines.  
**Surfaces:** Portal guest app (`data-app-surface="portal"`) · Denali plugin (`data-workspace-plugin="denali"`).

## Shell chrome

| ID | Hook / selector | Surface | Wave |
|----|-----------------|---------|------|
| SH-01 | `[data-portal-shell-header]` + `[data-portal-shell-logo]` | Member shell | 1 |
| SH-02 | `[data-portal-locale-switcher]` | Member shell | 1 |
| SH-03 | `[data-portal-shell-bottom-nav]` + `[data-portal-shell-nav-icon]` | Bottom nav icons (incl. profile when entitled) | 2 |
| SH-04 | `[data-portal-shell-nav-link][data-active="true"]` | Active tab tint | 2 |

## Registration (guest)

| ID | Hook / selector | Surface | Wave |
|----|-----------------|---------|------|
| REG-01 | `[data-portal-registration-chrome]` | Logo + back bar | 1 |
| REG-02 | `[data-registration-stepper]` + `[data-registration-step-state]` | Step indicator | 2 |
| REG-03 | `[data-public-registration-flow]` | Active step body | — |

## Member modules

| ID | Hook / selector | Surface | Wave |
|----|-----------------|---------|------|
| MEM-HOME-01 | `main[data-portal-member-home]` + quick-link cards | Home | 3 |
| MEM-TRIP-01 | `[data-portal-member-registration-row]` + status badge | Trips list | 2 |
| MEM-TRIP-02 | `[data-portal-member-registrations-empty-cta]` | Empty → marketing `/tours` | 3 |
| MEM-WALLET-01 | `main[data-portal-member-module-stub][data-portal-member-module-id="wallet"]` | Hidden wallet stub | 3 |
| MEM-PROF-01 | `main[data-portal-member-profile]` | Profile form | — |

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
| Home | `http://denali.portal.localhost:3003/me/home` |
| Trips | `http://denali.portal.localhost:3003/me/registrations` |
| Wallet (grant required) | `http://denali.portal.localhost:3003/me/wallet` |

## Automated coverage

| Spec | IDs |
|------|-----|
| `apps/portal/test/portal-visual-wave1.spec.ts` | REG-01, SH-01, SH-02 |
| `apps/portal/test/portal-visual-wave2.spec.ts` | REG-02, SH-03 |
| `apps/portal/test/portal-visual-wave3.spec.ts` | MEM-TRIP-02, MEM-WALLET-01, TOK hooks |
| `apps/portal/test/guest-theme-stack.spec.ts` | TOK-01 skin import |
| `apps/marketing/test/resolve-app-locale.spec.ts` | GX-1 (`MKT-GX-01`) |
| `apps/marketing/test/marketing-shell-nav.spec.ts` | GX-1 shell wiring (`MKT-GX-02`) |
| `apps/portal/tests/e2e/portal-shell-visual.spec.ts` | SH-01 baseline (`SMK-PTL-VIS-01`, tour `…0220` on `denali.portal`) |
| `scripts/guards/guard-public-catalog-m17.mjs` | TOK-01/02 DTCG guest semantic primary |
