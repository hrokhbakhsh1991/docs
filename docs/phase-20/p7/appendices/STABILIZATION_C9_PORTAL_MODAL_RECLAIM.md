# C9 — Portal login modal reclaim

```yaml
doc_id: STABILIZATION_C9_PORTAL_MODAL_RECLAIM
status: DONE
unlock: YES — IMPL-PORTAL-MODAL
date: "2026-07-21"
canonical_branch: booking/capacity-concurrency-cert
source: wip/portal-psc-20260718 @ 25f995c7
tip_at_start: e4e58665
```

## Scope (in)

Reclaim **only** the PCMS login modal experience onto the capacity tip:

| Surface | Change |
| ------- | ------ |
| Portal auth UI | `PortalLoginModalProvider` + dialog/sheet; thin `/login` host auto-opens modal |
| Register host | Same-page `PortalRegisterSignInLink` + `?auth=login` opener (no navigate-away for sign-in) |
| Flow contract | SSR-stable `memberLoginEgress` / `memberLoginStayOnPage` / `onMemberLoginSessionReady` on `RegistrationFlowContext` |
| Flow UI package | Context-based egress; `waitForMemberSessionCookie` + `completeMemberLoginEgressAfterSession` |
| Theme | Denali `login-page.css` modal / sheet rules |
| Verification | Portal + catalog-registration-flow-ui static/contract specs updated for modal hooks |

## Scope (out)

Explicitly **not** reclaimed from `25f995c7` (mixed WIP snapshot):

- Finance / booking payment / receipt / denali-finance deletions
- Member header / marketing chrome redesign
- Middleware legacy host 308 + cookie `shared` domain changes
- `tenant-kernel` canonicalize / multi-level host spikes unrelated to modal wiring

Those remain on `wip/portal-psc-20260718` / stash archaeology unless separate unlocks land.

## Logic

1. **Login host** (`/login?portalReturn=…`) renders a thin page and opens the shared modal with `host="login"`. After OTP/profile, egress waits for session cookie then `location.assign(portalReturn)`.
2. **Register host** keeps `PortalAuthExperienceShell`. Sign-in is a button that opens the same modal with `host="register"` + `memberLoginStayOnPage`. On success the modal closes and the register page reloads so intake resume can pick up the session.
3. **Hydration safety:** egress mode comes from SSR props / flow context — never `window` during render (`PCMS-UX-HYDRATE`).

## Doc-first (workspace-sdk)

`RegistrationFlowContext` gains optional modal fields — mirrored in `packages/workspace-sdk/SDK_CONTRACTS.md` in the same land as the TypeScript contract.

## Verify (fast-track)

```bash
pnpm --filter @apps/portal exec node --test test/portal-member-login-page.spec.ts \
  test/public-catalog-registration-flow-contract.spec.ts \
  test/portal-registration-resume.spec.ts
pnpm --filter @app-tour/catalog-registration-flow-ui exec node --test test/read-portal-return.spec.ts \
  test/catalog-registration-auth-steps.spec.ts
pnpm run guard:import-boundary
```

## Companion

- Park note: [STABILIZATION_C9_C10_PARKED.md](./STABILIZATION_C9_C10_PARKED.md)
- Unlock menu: [`docs/phase-saas-kernel/appendices/ARCHITECT_UNLOCK_MENU.md`](../../phase-saas-kernel/appendices/ARCHITECT_UNLOCK_MENU.md)

## Landed evidence (2026-07-21)

| Check | Result |
| ----- | ------ |
| Portal modal contract specs | 28/28 PASS (login + flow contract + resume + seo + visual) |
| `@app-tour/catalog-registration-flow-ui` tests | 7/7 PASS |
| `guard:import-boundary` | PASS |
| Package builds | workspace-sdk, catalog-registration-auth, catalog-registration-flow-ui PASS |

