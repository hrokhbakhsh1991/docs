# Tour storage (aggregate persistence)

```yaml
surface: apps/api/src/storage
kernel_design: docs/phase-saas-kernel/appendices/SK4_AUDIT_FILE.md
```

## What this folder is

**Tour aggregate** persistence port (`TourStorageRepository`) — prisma vs memory — plus production driver assert.

This is **not** the general tenant object/blob file service.

## Object / blob media (elsewhere)

| Use | Where |
| --- | ----- |
| Receipt proof signed URLs | finance `ReceiptProofStoragePort` + host receipt-proof-storage |
| Branding / avatar / wizard photos | tenant-branding-storage, operator-avatar-storage, tour-wizard-photos |

Shared `TenantObjectStoragePort` (SK4) is demand-driven when two blob call sites need one ACL/lifecycle policy.

## Shared blob client

Object put/sign for branding/avatar/receipt already share `../tenant/workspace-branding-photo-storage`. See SK4 / IMPLEMENTATION_BACKLOG before extracting another layer.
