# P6 — OTP sharing scope (G-P6-UI-05)

```yaml
scope_id: OTP-SCOPE-P6
gap_id: G-P6-UI-05
epic: P6-1
status: CLOSED_INTENTIONAL
```

## Decision (frozen for P6)

| Layer | Location | Shared? |
| ----- | -------- | ------- |
| **Logic** | `packages/ui-primitives/src/utils/otp-segment-input.logic.ts` | ✅ **Yes** |
| **Export** | `@app-tour/ui-primitives/otp-segment-input-logic` | ✅ gated in `import-boundary-ast.mjs` |
| **UI component** | `apps/web/src/features/auth/otp-segment-input.tsx` | Per-app thin shell |
| **UI component** | `apps/portal/src/features/auth/otp-segment-input.tsx` | Per-app thin shell |
| **Hook** | `data-otp-segment-input` on root element | Both apps — Playwright contract |

**Rationale:** Operator login and guest portal registration have different layout/a11y (admin chrome vs guest flow). P6 shares **normalization + segment behavior** only; full `OtpSegmentInput` package primitive is **post-P6** optional polish. Live guest OTP is `catalog-registration-flow-ui`; the portal thin shell must still follow the same clipped-sink + i18n cell labels (`catalogRegistration.otp.*`) so a future rewire cannot revive English `Digit N`.

---

## What agents must do

```typescript
// ✅ Logic — import from package
import { normalizeOtpDigits, OTP_SEGMENT_LENGTH } from "@app-tour/ui-primitives/otp-segment-input-logic";

// ✅ App UI — keep local wrapper; re-export logic for tests
export { normalizeOtpDigits, OTP_SEGMENT_LENGTH } from "@/features/auth/otp-segment-input.logic";

// ❌ Duplicate normalizeOtpDigits in portal and web
// ❌ Import ui-primitives barrel
```

---

## Verification

| ID | Spec | Assert |
| -- | ---- | ------ |
| OTP-LOGIC-01 | `apps/web/test/otp-segment-input.spec.ts` | normalize length 4 |
| OTP-LOGIC-02 | portal contract specs | `data-otp-segment-input` present |
| OTP-GATE-01 | `guard:import-boundary` | `otp-segment-input-logic` subpath allowed |
| OTP-GATE-02 | `p6-guest-slice.spec.ts` GS-01 | registration flow markers |

---

## Post-P6 optional (not required for closure)

- Move full `OtpSegmentInput` React component to `packages/ui-primitives/src/OtpSegmentInput/`
- Thin re-exports in web/portal only
- Visual regression in `ui-primitives/test:visual`

Until then: **do not** treat missing package component as a P6 gap.

---

## References

- [p6-implementation-standards.mdoc](../../p6-implementation-standards.mdoc) §4
- [p6-1-guest-slice.md](../p6-1-guest-slice.md) N-006
