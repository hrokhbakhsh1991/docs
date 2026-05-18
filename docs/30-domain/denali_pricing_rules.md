# Denali pricing rules (pilot spec)

> **Pilot spec — implementation status**  
> Sections **§2–§4** (acquaintance/stranger, share-cost / دنگ, driver vs passenger) are **NOT IMPLEMENTED** in code.  
> Production behavior today is **generic catalog pricing** via `PricingEngineService` (§6).  
> Do **not** merge `DenaliShareCostRule` or other Denali amount logic until product sign-off closes §2–§4 (see Sign-off table).

**Status:** Pilot documentation + go-live guards (2026-05-18)  
**Version:** 0.2  
**Date:** 2026-05-18  
**Governance:** No Denali-specific **payment amount** implementation should merge without linking this document.

**Related:** [`data_model.md` §5.1](../20-architecture/data_model.md#51-payment-status-algebra-backend-validation-baseline), [`denali-finance-runbook.md`](../60-operations/denali-finance-runbook.md), [`map-phase.md`](../../map-phase.md) فاز ۶ / ۱۲.

---

## 1. Scope (tenant)

| Rule | Detail |
|------|--------|
| **Pilot** | Rules in this document apply to the **Denali** workspace first (`provision-denali-tenant.ts`). |
| **Other tenants** | Use catalog/finance `PricingEngine` + `cost_context` only until a tenant flag or rule pack is introduced. |
| **Out of scope** | Multi-currency FX, tax/VAT, invoicing, PSP fee absorption. |

**Example:** Denali tour with `requiresPayment: true` uses amounts from locked quote / `Payment.amount`, not ad-hoc UI guesses.

**Edge case:** Cloned tour in non-Denali tenant — treat as generic tenant until Denali rule pack is enabled.

---

## 2. Acquaintance vs stranger

| Rule | Detail |
|------|--------|
| **Definition (pilot)** | **Acquaintance** = registrant is an active member of the Denali workspace with prior participation metadata (TBD: `user_tenants` + optional form field). **Stranger** = public/guest registrant without membership. |
| **Input** | Registration channel (public vs authenticated) + optional wizard/profile field `relationshipToGroup` (to be added in form builder). |
| **Pricing impact (TBD product)** | Stranger may pay list catalog price; acquaintance may receive share-cost or driver discount — see §3–§4. |

**Example:** Public register on paid tour → stranger pays full `Payment.amount` from intent (e.g. 1_200_000 IRR).

**Edge case:** Member registers via public link without JWT — classify as stranger until linked identity proves membership.

**Out of scope:** Automated social-graph inference.

---

## 3. Share-cost (دنگ)

| Rule | Detail |
|------|--------|
| **Concept** | Total tour cost (`cost_context.totalCost` or departure catalog total) is split across paying participants. |
| **Formula (baseline)** | `share_i = floor(total_minor / n_payers)` with remainder assigned per §7 rounding policy. |
| **Denominator `n_payers`** | Count of registrations in `Accepted` / `AcceptedPaid` that are not `Cancelled` and are flagged `paysShare=true` (TBD field). |

**Example:** `totalCost = 12_000_000` IRR, 4 payers → `3_000_000` each if no remainder.

**Edge case:** Driver does not consume a share slot — reduce `n_payers` by 1 (see §4).

**Out of scope:** Partial tour attendance (join mid-trip).

---

## 4. Driver vs passenger

| Rule | Detail |
|------|--------|
| **Driver** | Participant who provides private car transport (`transportModes` includes `private_car` or `primaryTransportMode === private_car`). |
| **Passenger** | Other paying participants. |
| **Driver payment (pilot)** | Driver pays **fuel share only** when `tripDetails.logistics.fuelShareToman` is set (wizard field `logistics.fuelShareToman`); otherwise driver share follows §3. |
| **Passengers** | Split remaining tour cost after subtracting driver fuel share from total. |

**Example:** Total 10_000_000 IRR, fuel 2_000_000 IRR, 3 passengers + 1 driver → driver pays 2_000_000; passengers split 8_000_000 three ways (see §7).

**Edge case:** Tour without private car — all participants use §3 only.

**Out of scope:** Multi-vehicle convoys with multiple drivers.

---

## 5. Per-participant payable amount

| Source field | Use |
|--------------|-----|
| `tours.cost_context.totalCost` | Denominator for share-cost when no departure catalog line exists. |
| `tours.cost_context.currency` | ISO 4217 (e.g. `IRR`, `USD`); must match `Payment.currency`. |
| `tours.cost_context.requiresPayment` | When `true`, registration must create payment intent or manual debt. |
| `tripDetails.logistics.fuelShareToman` (wizard `logistics.fuelShareToman`) | Driver fuel component (§4). |
| `PricingEngineService.quote` / locked pricing | **Authoritative** for online intent and authenticated booking. |
| `Payment.amount` | Authoritative for manual receipt and webhook settlement ([`data_model.md`](../20-architecture/data_model.md) CLAR-017). |

**Example:** Online register returns `paymentIntent.amount` = quoted total minor converted to decimal string.

**Edge case:** Leader edits tour `totalCost` after registrations — locked pricing on existing bookings must not change (wizard/registration policy).

---

## 6. Pricing engine

| Rule | Detail |
|------|--------|
| **Engine** | `PricingEngineService` (API) delegates to finance `PricingEngine` rule chain: tenant → catalog → role → discount (`FINANCE_PRICING_RULES_ID`). |
| **Denali extensions** | Pilot-specific acquaintance/driver rules are **not** implemented yet; this spec is the gate for adding rules (e.g. `DenaliShareCostRule`). |
| **Versioning** | Quotes expose `pricing_rule_version` hash for audit. |

**Out of scope:** Replacing catalog engine with spreadsheet imports.

---

## 7. Currency rounding

| Rule | Detail |
|------|--------|
| **Storage** | Amounts in DB use decimal string / minor units per existing payment entities. |
| **IRR (Toman/Rial)** | Display in Toman; store consistent with `Payment` (product: 1 Toman = 10 Rial if dual display — confirm in UI). |
| **Rounding** | Remainder from integer division: assign **+1 minor unit** to lowest `registration_id` lexicographic until remainder exhausted (deterministic). |
| **Validation** | `paid_amount` MUST NOT be negative ([`data_model.md` §5.1](../20-architecture/data_model.md#51-payment-status-algebra-backend-validation-baseline)). |

---

## 8. `requiresPayment` without amount

| Rule | Detail |
|------|--------|
| **Allowed?** | **No** for go-live paid tours: if `requiresPayment === true`, `totalCost` (or catalog quote) MUST be present before `Open` lifecycle. |
| **API / wizard** | Enforced on publish/Open: `PAID_TOUR_REQUIRES_AMOUNT` (API) and wizard `pricing.basePrice > 0` when `requiresPayment` (submit mode). |
| **Runtime** | Payment intent creation fails validation when payable amount cannot be derived. |

**Edge case:** Draft tour with `requiresPayment` — allowed until publish.

---

## 9. Manual receipt vs leader `PATCH .../payment`

| Rule | Detail |
|------|--------|
| **Authoritative for Paid** | `Payment` row status (`Paid` / webhook / receipt approve) is source of truth for registration → `AcceptedPaid`. |
| **Leader PATCH** | Operational visibility (`payment_status`, `paid_amount`) per FR-51; **must not** override an approved `Payment` without reconciliation. |
| **Manual receipt flow** | **Complements** leader PATCH: finance creates manual debt → user uploads receipt → admin approve sets `Payment.Paid` and transitions registration. |
| **Conflict** | If PATCH says Paid but `Payment` is Pending → reconciliation task; API policy: Payment wins on read/export. |

---

## 10. Traceability

| ID | Requirement | This spec |
|----|-------------|-----------|
| FR-50 | Payment-proof manual verification | §9 manual receipt |
| FR-51 | Leader sets NotPaid / Partial / Paid | §9 PATCH complement |
| FR-52 | Optional paid amount per registration | §5, §7 |
| FR-53 | Operational tracking, not PSP in MVP | §6, runbook |
| `data_model.md` §5.1 | Payment status algebra | §7, §9 |
| `data_model.md` §5.2 | Registration lifecycle | §9, runbook webhook |

---

## Sign-off

| Section | Owner | Status | Target |
|---------|-------|--------|--------|
| §1 Scope, §5–§9 guards, §10 traceability | Engineering | **Accepted** (pilot) | 2026-05-18 |
| §2 Acquaintance / stranger | Product | **Post-pilot (TBD)** | Owner + date TBD |
| §3 Share-cost (دنگ) | Product | **Post-pilot (TBD)** | Owner + date TBD |
| §4 Driver / passenger | Product | **Post-pilot (TBD)** | Owner + date TBD |
| §6 Pricing engine extensions | Engineering | **Not started** | After §2–§4 sign-off |

| Role | Name | Date | Notes |
|------|------|------|-------|
| Product / Denali pilot | Denali finance pilot scope | 2026-05-18 | Doc pilot for finance flows; numeric دنگ rules deferred per table above |
| Engineering | Finance pilot implementation | 2026-05-18 | `requiresPayment` go-live guard shipped (فاز ۱۲); no `DenaliShareCostRule` until §2–§4 close |
