# First customer — operator daily ops (P6-2)

```yaml
epic: P6-2
nano: P6-2-N-016
smoke_club: operator
vertical_slice: [VS-06, VS-07]
```

Manual steps for **VS-06** (approve booking) and **VS-07** (approve receipt) after guest/member flows complete.

## Prerequisites

- P6-1 guest slice green — pending booking exists from portal registration
- P6-3 member portal — optional receipt uploaded (VS-05)
- Admin host: `http://operator.admin.localhost:3000` (legacy: `operator.localhost:3000`)

---

## VS-06 — Approve booking

1. Login operator OTP (`1234` dev)
2. Open **Bookings** command center or tour workspace → **Registrations**
3. Locate pending row from portal registration (party size, guest name)
4. **Approve** booking
5. Verify status `approved` · catalog `spotsRemaining` decrements if applicable

**API proof:** `bookings-ops.spec.ts` · `bookings-command-center.spec.ts`

---

## VS-07 — Approve receipt (offline_receipt)

1. Navigate **Finance** → receipts pending tab
2. Open receipt linked to approved registration (member upload from VS-05)
3. **Approve** receipt → ledger event emitted
4. Verify finance summary / registration payment status updated

**API proof:** `finance-ops.spec.ts` (API-9.7-03)

---

## Related surfaces

| Surface | Path |
| ------- | ---- |
| Tour workspace registrations | `/tours/{tourId}/workspace` |
| Waitlist promote | `/tours/{tourId}/workspace/waitlist` |
| Reconciliation triage | `/settings/reconciliation-triage` |
| Finance hub | `/finance` |

---

## Env

| Variable | Purpose |
| -------- | ------- |
| `ALLOW_DEV_WEB_SESSION` | dev tenant host map |
| `TOUR_OPS_API_URL` | BFF → API |

See [host-subdomain-map.md](host-subdomain-map.md).
