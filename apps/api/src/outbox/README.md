# Outbox — durable effects transport

```yaml
surface: apps/api/src/outbox
role: durable_domain_event_transport
kernel_design: docs/phase-saas-kernel/appendices/SK2_NOTIFICATION_OUTBOX.md
```

## What this folder is

PostgreSQL-backed **outbox** enqueue + relay + production posture:

- `enqueue-domain-event.ts` — persist events in the same transaction as domain writes  
- `outbox-relay.ts` — claim / publish / mark-done under tenant RLS session  
- `assert-production-outbox-relay-posture.ts` — prodlike must relay in-process **or** external worker with `APPS_API_WORKER_ROLE=outbox-relay`

## Notification (SK2)

Kernel notifications must ride this transport (see SK2 doc). There is **no** separate fire-and-forget notification bus.

Workspace/finance/booking **reactions** are domain side-effects registered via codegen — they are not a unified Email/SMS platform. A future `NotificationDeliveryPort` adapter plugs in beside relay without Denali templates in core.

## Related

- Hostile P0 outbox worker role: `docs/phase-20/p7/appendices/HOSTILE_AUDIT_REMEDIATION.md`  
- SK2 design: `docs/phase-saas-kernel/appendices/SK2_NOTIFICATION_OUTBOX.md`
