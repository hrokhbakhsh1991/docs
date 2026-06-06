# Audit event coverage and bypass paths (DEC-128)

```yaml
agent_load_tier: T2_behavioral
scope: audit_events append-only coverage
closes: AUDIT-GAP-05, AUDIT-GAP-07
cross_ref:
  audit_logger: apps/api/src/audit/audit-logger.ts
  phase2_audit: apps/api/docs/phase2-paranoid-audit.md
```

## Forensic vs non-forensic storage

| Driver                    | `appendAuditEvent`                           | Production                     |
| ------------------------- | -------------------------------------------- | ------------------------------ |
| `prisma` + `DATABASE_URL` | Yes — create/update/provision on Prisma path | Required (DEC-045)             |
| `memory`                  | Never                                        | Dev/CI only — **non-forensic** |

## Covered mutations (Prisma path)

| Action               | Trigger                      | `actor_id` source                          |
| -------------------- | ---------------------------- | ------------------------------------------ |
| `TOUR_CREATED`       | Atomic create TX             | `x-user-id` via tenant ALS when HTTP-bound |
| `TOUR_UPDATED`       | Atomic update TX             | Same                                       |
| `TENANT_PROVISIONED` | Admin provision TX (DEC-127) | **null** — internal dev route, no user ALS |

## AUDIT-GAP-05 — nullable `actor_id`

**Policy:** `audit_events.actor_id` is **nullable by design**.

| Context                           | `actor_id`                     | Rationale                                |
| --------------------------------- | ------------------------------ | ---------------------------------------- |
| HTTP `/tours` with auth headers   | Pseudonymized `x-user-id`      | User-attributed forensic row             |
| Internal provision / seed         | `null`                         | Privileged admin path; no end-user actor |
| Background relay / reconcile jobs | `null` unless job re-binds ALS | System actor not modeled in Phase 5      |

**Not required for Phase 2 closure:** `requireActiveActorId()` on all writes — would block legitimate system rows. Phase 7 may introduce `actor_type=system` metadata if compliance requires non-null attribution.

## AUDIT-GAP-07 — intentional bypass paths

No Postgres trigger enforces audit on domain tables. Application code **must** call `appendAuditEvent` inside forensic TXs. Known bypass / no-row paths:

| Path                                                   | Audit row             | Notes                                                          |
| ------------------------------------------------------ | --------------------- | -------------------------------------------------------------- |
| `STORAGE_DRIVER=memory`                                | None                  | Non-forensic by design                                         |
| Pre-TX validation failure                              | None                  | DEC-007 — success-only policy                                  |
| `seedDevTenants` upsert (idempotent)                   | None on update branch | Dev seed only; create-only provision uses `TENANT_PROVISIONED` |
| Outbox relay status updates                            | None                  | AUDIT-GAP-04 — Phase 7 ops audit                               |
| `http_idempotency_records` / `processed_domain_events` | None                  | Technical dedup stores                                         |
| Validation queue shed / load shed                      | None                  | No domain mutation                                             |

## Static guard — `appendAuditEvent` call sites

`guard-forensic-storage-production` allows **definition** in `audit-logger.ts` and **call sites** only in:

| Module                                       | Action                                               |
| -------------------------------------------- | ---------------------------------------------------- |
| `canonical/atomic-canonical-tour-persist.ts` | `TOUR_CREATED` / `TOUR_UPDATED` in canonical TX      |
| `internal/provisioning.service.ts`           | `TENANT_PROVISIONED` in admin provision TX (DEC-127) |

Any new call site requires an ADR row and guard allow-list update.

## Verification

```bash
cd apps/api
pnpm run guard:tenant-provision-audit
pnpm run guard:tour-update-audit
pnpm run guard:forensic-storage
node --import tsx --test test/5.5-audit-events.spec.ts  # when DATABASE_URL set
```
