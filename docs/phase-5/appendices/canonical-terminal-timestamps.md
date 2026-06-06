# Canonical terminal timestamps — DB `now()` authority (DEC-084 / Wave B)

```yaml
status: implemented
phase: 4 resilience — Wave B
closes: CLK-F-03, CLK-F-04 (partial)
related: canonical-transaction-now.md, http-idempotency.md, outbox-publish-done-pairing.md
```

## Problem

Terminal writes used app `new Date()` while forensic surfaces compare against DB `created_at` / audit `now()`:

| Surface                 | Before                    | After (DEC-084)              |
| ----------------------- | ------------------------- | ---------------------------- |
| `markOutboxDone`        | `processedAt: new Date()` | `processed_at = now()` (SQL) |
| Idempotency `completed` | `completedAt: new Date()` | `completed_at = now()` (SQL) |

Clock skew between app and Postgres breaks ordering proofs (CLK-TT-03/04).

## Decision

Use **database authority** for terminal timestamps (FlowVerify / Cockroach ordering pattern):

```sql
UPDATE outbox_events SET status = 'done', processed_at = now() WHERE …
UPDATE http_idempotency_records SET status = 'completed', completed_at = now() WHERE …
```

Claim / processing rows may still use app time; **terminal** transitions use SQL `now()`.

## JWT drift spec (CLK-F-04)

`clock-skew-resilience.spec.ts` adds **CLK-SKEW-10**:

- Exactly **5s** past `exp` → still verifies (`clockTolerance: 5s`)
- **5s + 1ms** past `exp` → rejects
- Exactly **5s** before `exp` → still valid (not expired)

## Verification

```bash
cd apps/api && pnpm run guard:canonical-terminal-timestamps
node --import tsx --test src/outbox/outbox-mark-done.spec.ts
node --import tsx --test test/4-integration/clock-skew-resilience.spec.ts
```
