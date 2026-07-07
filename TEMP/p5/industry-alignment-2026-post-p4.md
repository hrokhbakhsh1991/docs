# Industry alignment — post-P4 (2026-06-21)

Research synthesis for P5 planning. Sources: web search + existing `docs/phase-16/platform-workspace-cutover.mdoc` + `apps/api/docs/legacy-vs-denali-gap-analysis.md`.

---

## 1. Metadata-driven multitenant SaaS

**Standard (2025–2026):** Single shared codebase; tenant behavior driven by external metadata (DB JSON, feature flags, subscription tier). Salesforce documents this as the core of multitenant CRM/SaaS: metadata describes UI + business logic; runtime kernel materializes per tenant.

**Our fit:** P3 shipped `WorkspaceDefinition` JSONB (fieldRegistry, ruleSet, wizard) + `resolveWorkspacePluginForTenant`. **Gap:** prod still package-only. **P5-A** closes Stage 2→3 pilot.

**References:**
- [Salesforce Platform Multitenant Architecture](https://architect.salesforce.com/docs/architect/fundamentals/guide/platform-multitenant-architecture)
- [Multi-Tenant SaaS 2026 Architecture Guide](https://apipilot.com/developing-a-multi-tenant-saas-application-the-2026-architecture-guide/)
- Enterprise CRM metadata patterns (Preprints 202601.2199) — configuration layer reduces TCO when admins own rule changes

---

## 2. Strangler Fig + parallel run + gateway routing

**Standard:** Facade routes requests to legacy or new implementation incrementally; parallel run validates parity before cutover; API gateway controls traffic modes (shadow, canary, full).

**Our fit:** Already implemented as code facade (`resolveWorkspacePluginForTenant`), not HTTP gateway. P3-D CI = parallel run. P5-A = pilot allowlist + observability + Super Admin visibility.

**References:**
- [Microsoft Strangler Fig](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig)
- [AWS Strangler Fig](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html)
- Gateway-controlled traffic modes (Towards Dev, 2025)

**Decision:** Keep in-process facade — simpler than edge routing for workspace plugin resolution; HTTP strangler reserved for future marketing/BFF splits.

---

## 3. Composable verticals (headless + plugin overlay)

**Standard:** Headless CMS / form platforms use plugin modules for custom field types; core stays stable. Strapi-style extensibility without forking core.

**Our fit:** `packages/workspaces/<id>` = thin overlay (hooks, composites, finance, theme). Metadata = field layout SoT. **Forbidden:** editing `field-registry/`, `rules/`, `composites/` in Denali during platform EPICs (`guard:p3-denali-covenant`).

---

## 4. Per-tenant / per-workspace commerce

**Standard (2026):** Stripe Connect **Accounts v2** — one `Account` object with modular configurations:
- `merchant` — accept payments from club customers
- `customer` — pay platform subscription fee
- `recipient` — receive transfers

Eliminates v1 pattern of separate Customer + Account sync.

**Our fit today:** `pricing.paymentMode` on tour canonical (`offline_receipt` | future gateway). Platform subscription billing exists (P2-C) but **club→customer PSP is Missing**.

**P5-C then P5-D:**
1. Workspace-level `commerce.paymentMode` in definition metadata + Super Admin UI
2. Adapter layer: offline receipt (existing) vs gateway intent (Zibal IR / Stripe v2)
3. Webhook ingress with HMAC + replay cache (port from legacy)

**References:**
- [Stripe Connect Accounts v2](https://docs.stripe.com/connect/accounts-v2)
- [SaaS platform configurations v1 vs v2](https://docs.stripe.com/connect/accounts-v2/saas-platform-payments-billing)
- [Building multi-tenant SaaS with Stripe Connect 2026](https://dev.to/diven_rastdus_c5af27d68f3/building-a-multi-tenant-saas-with-stripe-connect-in-2026-jjn)

**Regional note:** Zibal for Iran domestic; Stripe for international clubs — workspace config selects provider, not hardcoded in Denali package.

---

## 5. Control plane vs data plane

**Standard:** Platform ops (provision, billing, audit, impersonation, domain SSL) isolated from tenant operator workflows (wizard, tours, registrations).

**Our fit:** Super Admin `@ apps/web/(platform)` + `/platform/v1/*` API. Operator app uses tenant host + RLS. P5 adds cutover + commerce config to control plane without moving wizard logic into Super Admin.

---

## 6. Integration security (P0 from gap analysis)

**Standard:** SSRF-hardened outbound fetch — allowlist, DNS pin, no private IP, TLS verify.

**Our fit:** Legacy `@repo/security/egress-url` **Missing** in Denali trunk. `TenantHttpProxy` exists but not wired in `main.ts`. **Blocker for live PSP** — P5-D must land egress before production payment intents.

Source: `apps/api/docs/legacy-vs-denali-gap-analysis.md` § Proxy/integrations

---

## 7. Recommended model stack for app-tour

| Layer | Model | Status |
|-------|-------|--------|
| Tenant isolation | Shared DB + RLS (`with-tenant-rls`) | ✅ shipped |
| Workspace behavior | Metadata definition + package overlay | ✅ P3 · pilot ⬜ P5-A |
| Cutover | Strangler facade + feature flag + allowlist | ✅ code · ⬜ prod pilot |
| Product surfaces | Marketing catalog + portal + club sites | ✅ P4 |
| Commerce config | Metadata field + Super Admin | ⬜ P5-C |
| PSP | Zibal + Stripe Connect v2 | ⬜ P5-D |
| Operator parity | Lifecycle FSM + RuleSet on metadata path | ⬜ P5-B |
| Registrations | Capacity + throttle + finance side effects | ⬜ P5-E |

**Weighted recommendation:** Execute P5 EPICs in frozen order. Do **not** skip P5-A pilot or P5-D egress before enabling paid gateway mode in prod.


---

## Nano mapping (P5 execution)

| Industry pattern | P5 EPIC | Nano |
|------------------|---------|------|
| Strangler Fig pilot | P5-A | N-003..N-008 |
| Parallel run / parity | P5-B | N-006 N-010 N-013 |
| Commerce config | P5-C optional | N-001..N-010 |
| Stripe v2 / Zibal | P5-D optional | N-004 N-005 |
| Registration capacity | P5-E optional | N-002 N-003 |
