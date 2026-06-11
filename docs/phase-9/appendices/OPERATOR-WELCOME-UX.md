# Phase 9 — Operator Welcome Modal (UX + implementation)

```yaml
ux_spec_id: OPERATOR-WELCOME-UX
version: "2026-06-11-v3"
status: ACTIVE
subphase: "9.2+"
authority: ADMIN-SHELL-UX.md · OPERATOR-LOGIN-FLOW.md
pattern: platform gate + workspace-scoped i18n copy
```

## 1. Problem

After first successful operator login, the dashboard shows static subtitle copy (`خوش آمدید — نمای کلی {brandName}`) but no guided first-run moment. Denali owners (e.g. workspace founder) need a **warm, dismissible welcome-back dialog** after each login — personalized, ownership-toned, without a heavyweight product tour.

## 2. North star

| Principle | Implementation |
| --------- | -------------- |
| **One moment** | Modal on `/dashboard` only — not login, not every route |
| **One primary CTA** | «تور جدید» → `/tours/new` (DEC-P9-007) |
| **Skippable** | ESC, overlay, «اول داشبورد رو ببینم» — no permanent opt-out |
| **Every login** | Armed on successful OTP login; once per login until dismissed |
| **Warm ownership tone** | «خوش برگشتی» + «پنل خودت» for owner on Denali |
| **Personalized** | `{displayName}` from `GET /identity/me` |
| **Workspace-aware** | `{workspaceLabel}` + Denali tagline via i18n; gate keyed on `pluginId` |
| **Owner-only (v1)** | `role === owner` (DEC-P9-018 operator panel) |
| **Platform chrome** | Lives under `apps/web/src/admin/onboarding/` — not wizard |

## 3. Show conditions (v1)

```text
pathname === /dashboard
AND pluginId === denali
AND role === owner
AND operatorWelcomeArmed === true (set on login success)
AND !shownThisLogin
AND profile fetch succeeded
```

## 4. Dismiss contract

### Per-login session (shipped)

- `sessionStorage.operator-welcome-armed = 1` — synced from BFF cookie on dashboard mount (`syncOperatorWelcomeFromLoginCookie`)
- `Cookie operator-welcome-armed=1` (non-HttpOnly, 10 min) — set by `login-web-session` BFF for API/E2E login paths
- `sessionStorage.operator-welcome-presented = 1` — set when modal opens (prevents re-show on `/dashboard` remount before dismiss)
- `sessionStorage.operator-welcome-shown = 1` — set when user dismisses or clicks primary CTA
- Logout clears session keys + welcome cookie (`operator-shell` + `/api/auth/logout`)
- Same browser tab: refresh after dismiss does **not** re-show; new login re-arms

### Not shipped

- Permanent `localStorage` / server `welcomeDismissedAt` — rejected for owner panel; user expects greeting each login

## 5. UI stack

- Radix Dialog (`apps/web/src/components/ui/dialog.tsx`) — same primitive family as Sheet
- Denali surfaces: `data-denali-surface="card"`, existing `denali-admin.css` tokens
- Copy: `messages/{locale}/dashboard.json` → `welcome.*`
- Denali tagline: `app.denaliTagline` when `pluginId === denali`
- Tenant brand mark: `TenantBrandMark` in dialog header (`operator-welcome-brand-mark`)

## 6. Completion proofs

| ID | Check | Spec |
| -- | ----- | ---- |
| CP-WELCOME-03 | Non-owner / non-denali → no modal | `operator-welcome.spec.ts` |
| CP-WELCOME-04 | Primary CTA href `/tours/new` | `operator-welcome.spec.ts` |
| WEB-LOGIN-UI-08 | BFF cookie + gate wiring (no duplicate client arm) | `operator-login-ui-contract.spec.ts` |
| BFF-LOGIN-08 | Owner login sets welcome cookie | `auth-bff-login-codes.spec.ts` |
| BFF-9.1-05 | Logout clears welcome cookie | `auth-login-flow.spec.ts` |
| WEB-9.2-09 | Dialog test ids | `dashboard-smoke.spec.ts` |
| SMK-P9-WELCOME | E2E once-per-login dismiss | `operator-smoke.spec.ts` |

## 7. Out of scope

- Multi-step checklist / Pendo-style tours
- Urban/starter welcome content (resolver returns inactive)
- Blocking modal without dismiss path
