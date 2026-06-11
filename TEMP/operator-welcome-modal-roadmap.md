# Operator Welcome Modal — Roadmap

**Status:** Phase 1 complete (per-login warm welcome)

## Behavior (v2)

- Shows **once per login** after OTP success → dashboard
- `armOperatorWelcomeForLogin()` in `login-form.tsx`
- Dismiss via sessionStorage — **no** permanent «دیگر نشان نده»
- Owner copy (fa): «{displayName} عزیز، خوش برگشتی!» + «پنل خودته»

## Verify

1. Logout → login as فرهنگ معیری on denali.localhost
2. Dashboard modal with warm Persian copy
3. Dismiss → refresh dashboard → no modal
4. Logout → login again → modal returns

## Docs

`docs/phase-9/appendices/OPERATOR-WELCOME-UX.md` (v2)

## v3 (completed)

- BFF cookie `operator-welcome-armed` on login-web-session
- Cookie sync in welcome gate (E2E + API login paths)
- Logout clears session + cookie
- Owner dashboard subtitle warmer
- SMK-P9-WELCOME E2E test
