# CW4-05 — Registration model divergence contract (DEC-CW-01 Option B)

**Status:** Implemented (CW Wave 3E)  
**Decision:** DEC-CW-01 Option B — dual persistence models + neutral orchestration predicates; no string/table merge.

## Contract location

| Artifact | Path |
|----------|------|
| Registration model types + predicates | `packages/workspace-sdk/src/registration/registration-model-divergence.contract.ts` |
| Member display semantics (DEC-CW-04) | `packages/workspace-sdk/src/registration/member-registration-display-status.ts` |
| Certification spec | `packages/workspace-sdk/test/registration-model-divergence.contract.spec.ts` |

## Neutral predicates (orchestration only)

| Predicate | Booking (`operatorApproval`) | Urban (`atCreate`) |
|-----------|------------------------------|-------------------|
| `registrationOccupiesSeat` | `status === "approved"` | `status === "confirmed"` |
| `registrationQueuedWithoutSeat` | `status === "waitlisted"` | `status === "waitlist"` |
| `registrationAwaitingOperatorDecision` | `status === "pending"` | always false |
| `registrationTerminalNegative` | `status === "rejected"` | always false |
| `registrationVoided` | `status === "cancelled"` | `status === "cancelled"` |

**Not normalized:** `approved` ↔ `confirmed`, `waitlisted` ↔ `waitlist`, persistence tables, outbox semantics.

## Frozen models

- `BOOKING_REGISTRATION_MODEL` — `operator_registrations`, `bookingPipeline` lifecycle profile
- `URBAN_REGISTRATION_MODEL` — `urban_registrations`, `atCreateTerminal` lifecycle profile

CW0-05 parity golden remains the executable divergence witness.

## Verification

```bash
node --import tsx --test packages/workspace-sdk/test/registration-model-divergence.contract.spec.ts
pnpm run test:parity  # CW0-05
```

---

*Architect, documentation status: Updated. Link to docs: `docs/dev/cw4-05-registration-model-divergence-contract.md`.*
