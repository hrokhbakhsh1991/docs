# Manual e2e security matrix (M8–M12)

Run before production when automated gates are not enough.

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| M8 | Cross-tenant JWT on workspace host | Login ws1; copy cookie; open ws2 host with same cookie | `401` / `TENANT_HOST_TOKEN_MISMATCH` on API; Web redirects or 401 on BFF |
| M9 | Workspace session wrong host | `POST /api/v2/auth/workspace/session` with body tenant A while Host is tenant B | `403` `TENANT_HOST_MISMATCH` |
| M10 | CORS evil origin | Browser `fetch` API `:3001` from `https://evil.example` with credentials | No `Access-Control-Allow-Origin` for evil |
| M11 | Host probe flood | Rapid requests to apex/unknown slug | `429` `WORKSPACE_HOST_PROBE_RATE_LIMITED` (Web middleware) |
| M12 | Logout + replay | Logout; replay old cookie to `GET /api/me` | `401` `AUTH_UNAUTHENTICATED` or revoked |

**Automated helpers:** `node scripts/verify-security-baseline.mjs` · `node scripts/verify-phase-7-tenant-security.mjs` (live smoke when API/Web up).
