# Tenant audit logging (enterprise)

This repository stores **immutable, append-only** security and compliance events per workspace tenant in PostgreSQL table **`tenant_audit_events`**. Rows are protected by the same **RLS tenant isolation** model as other `tenant_id`-scoped tables; **`UPDATE` and `DELETE` are rejected** by a database trigger.

## Schema (`tenant_audit_events`)

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` | Primary key |
| `tenant_id` | `uuid` | Workspace tenant (RLS scope) |
| `occurred_at` | `timestamptz` | Event time (defaults `now()` on insert) |
| `actor_user_id` | `uuid` | Acting user when applicable |
| `actor` | `varchar(320)` | Human-readable actor label (typically email) |
| `user_id` | `uuid` | Primary subject user when applicable |
| `action` | `varchar(96)` | Stable action identifier (see below) |
| `resource_type` | `varchar(96)` | Logical resource kind |
| `resource_id` | `varchar(128)` | Optional resource identifier |
| `metadata` | `jsonb` | Structured details (old/new role, switch targets, export filters, …) |
| `client_ip` | `varchar(128)` | Client IP from trusted proxy-aware resolution |
| `request_id` | `varchar(128)` | Correlates with API logs / tracing |

### Actions emitted today

| `action` | When |
|----------|------|
| `auth.login.web` | Successful **web OTP** session for host-resolved tenant (`POST /api/v2/auth/web/session/otp`) |
| `auth.login.telegram` | Successful Telegram login |
| `auth.workspace.switch` | JWT re-issue for another workspace (`from_tenant_id` / `to_tenant_id` in `metadata`; row stored under **JWT tenant before switch** for RLS correctness) |
| `membership.role.changed` | PATCH user role or bulk role update |
| `workspace.ownership.transferred` | Dedicated ownership transfer flow |
| `workspace.invite.accepted` | Invite acceptance (`joined_tenant_id` in `metadata`; row stored under **JWT tenant at accept time**) |
| `data.export.audit_trail` | Workspace owners/admins export the audit stream |

Additional actions can be registered by extending `TenantAuditAction` in `apps/api/src/common/audit/tenant-audit-actions.ts`.

## Implementation

- **Entity:** `apps/api/src/common/audit/entities/tenant-audit-event.entity.ts`
- **Service:** `TenantAuditEventsService` (`append`, `appendOrWarn`, export helpers)
- **Migration:** `apps/api/src/database/migrations/1777576000000-TenantAuditEvents.ts` (RLS + append-only trigger)
- **IP / request correlation:** `RequestContextMiddleware` stores `clientIp`; `RequestContextService.tryGetClientIp()` / `tryGetRequestId()` feed audit rows.

Authentication paths use **`appendOrWarn`** so a failing audit insert cannot block login.

## Export API

`GET /api/v2/workspaces/:tenantId/audit-events/export`

- **Auth:** Bearer JWT whose `tenant_id` **must equal** `:tenantId`.
- **Roles:** workspace **owner** or **admin**.
- **Query:** `from`, `to` (ISO-8601), `format` (`csv` \| `ndjson` \| `json`), `limit` (max 50 000).
- Each successful export appends a **`data.export.audit_trail`** event (the next export includes it).

## Operational notes

- **Immutability:** enforced in the database (trigger). Application code must only **insert**.
- **Retention / archival:** not automated here; ship logs to cold storage or SIEM according to policy.
- **Tamper evidence:** for stronger guarantees (hash chains, WORM storage), extend ingestion downstream of this table.
