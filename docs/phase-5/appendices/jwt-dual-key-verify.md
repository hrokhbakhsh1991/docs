# JWT dual-key verify window (DEC-107 / SM-VUL partial)

```yaml
status: implemented
phase: 5 evolution — P2 Phase 3
closes: SM-VUL dual-key gap (partial — no auto-rotation pipeline)
related: production-deploy-checklist.md § JWT rotation
```

## Problem

Only one `AUTH_JWT_PUBLIC_KEY` — rotation requires simultaneous PEM swap + pod restart; no overlap window ([SM-VUL](phase5-evolution-audit.md)).

## Decision

| Env                            | Role                                                  |
| ------------------------------ | ----------------------------------------------------- |
| `AUTH_JWT_PUBLIC_KEY`          | Primary verify key (required in production)           |
| `AUTH_JWT_PUBLIC_KEY_PREVIOUS` | Optional second PEM — tried when primary verify fails |

Rotation playbook:

1. Deploy new key as **primary**; move old key to **PREVIOUS**.
2. Issue new tokens from new private key.
3. After TTL overlap, remove `AUTH_JWT_PUBLIC_KEY_PREVIOUS`.

No vault or auto-rotation in trunk — manual env only.

## Verification

```bash
cd apps/api && pnpm run guard:jwt-dual-key-verify
node --import tsx --test src/tenant-kernel/parse-jwt-bearer.spec.ts
```
