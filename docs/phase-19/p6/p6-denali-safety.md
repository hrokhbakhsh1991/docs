# P6 — Denali safety (STOP rules)

```yaml
pack_version: "2.1"
workspace: denali
payment: offline_receipt
three_apps: true
addressing: ../p6-host-addressing-architecture.mdoc
```

## Architecture (do not collapse)

```text
apps/marketing  — public only ({club}.{root} or custom apex)
apps/portal     — user only ({club}.portal.{root})
apps/web        — admin only ({club}.admin.{root})
```

Do **not** permanently host public catalog or member `/me` inside `apps/web` — web keeps redirect shims only.

## Must preserve

PC-01..10 — wizard, clone, settings, receipts, offline_receipt, catalog revalidate (see P6-2-N-015).

## Forbidden

```text
❌ Merge three apps into one deploy for "speed"
❌ Gateway / Stripe / Zibal for customer 1
❌ Super Admin operator wizard
❌ Delete denali rules/composites
❌ Start P6-2 before GUEST_SLICE_OK (P6-1-N-014)
❌ Skip P6-0 host parity
```

## Allowed

```text
✅ Fix admin minimal publish for P6-1 only
✅ Expand subdomain routing + runbooks
✅ Portal /me routes (P6-3)
✅ Admin depth fixes (P6-2)
```

## Doc-first

Changes to api/web/marketing/portal/denali → update `docs/phase-19/*.mdoc` first.
