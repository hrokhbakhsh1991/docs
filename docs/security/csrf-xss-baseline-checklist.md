# CSRF / XSS baseline checklist (Tour-Ops web + API)

Use before production releases; not a full OWASP audit.

## CSRF

- [ ] Session cookie: `HttpOnly`, `SameSite` (`lax` dev / `none`+`Secure` cross-site prod).
- [ ] Auth mutations from UI go to same-origin `/api/auth/*` (BFF), not cross-origin POST to `:3001`.
- [ ] API CORS: no `origin: true`; `credentials: true` only with explicit allowlist.
- [ ] State-changing API routes require `Authorization: Bearer` (not cookie-only on API origin).
- [ ] Review any future form POST to Nest direct origin — require CSRF token or same-site-only.

## XSS

- [ ] No `dangerouslySetInnerHTML` in `apps/web` app routes (grep periodically).
- [ ] User-generated text rendered as React text nodes or sanitized components.
- [ ] CSV/export paths escape formula injection where applicable.
- [ ] Content-Security-Policy at edge (API Helmet is minimal; UI CDN/nginx may add CSP).

## Verification commands

```bash
rg 'dangerouslySetInnerHTML' apps/web --glob '!**/node_modules/**'
rg 'origin:\s*true' apps/api/src/main.ts
```
