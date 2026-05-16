# JWT session claims — size guidance

Session tokens are RS256 JWTs in the HttpOnly `session` cookie.

| Claim | Notes |
|-------|--------|
| `sub` | User id |
| `tenant_id` | Active workspace |
| `role` | Workspace role |
| `sess_ver` | Revocation version |
| `caps` | Optional capability snapshot (array of strings) |

**Operational limits:** keep `caps` under ~2 KB serialized; avoid unbounded custom claims. If capability lists grow, prefer server-side hydration (`GET /api/v2/auth/ability-context`) instead of expanding the JWT.

Monitor cookie header size (< 4 KB total per cookie recommended).
