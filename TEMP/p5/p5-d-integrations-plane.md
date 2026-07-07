# P5-D — Integrations Plane · Nano-Task Spec (AI v2.9)

```yaml
doc_id: P5-D-INTEGRATIONS
version: 2.9-ai-friendly
nano_tasks: 10
optional: true
doc_first: docs/phase-18/platform-integrations-plane.mdoc
legacy_ref: apps/api/docs/legacy-vs-denali-gap-analysis.md
quality_target: 9.9+/10
```

## §Facts frozen

| # | Fact |
|---|------|
| F1 | egress-url Missing in trunk | gap analysis |
| F2 | TenantHttpProxy not wired | main.ts |
| F3 | Stripe new = Accounts v2 | AGENT-START |
| F4 | EG-01 before PSP-01 | AD-S1-02 |

## Legacy port map (reference only)

| Legacy | Target |
|--------|--------|
| `@repo/security/egress-url` | `apps/api/src/integrations/egress/` |
| `zibal-payment-gateway.impl.ts` | `integrations/payments/zibal/` |
| `stripe-payment-gateway.impl.ts` | `integrations/payments/stripe-connect-v2/` |
| `payments-webhook.controller.ts` | `integrations/webhooks/` |

---

### P5-D-N-001 [DOC] — threat model + egress sequence diagram in mdoc

**NEXT:** N-002

### P5-D-N-002 [IMPLEMENT] — egress assertSafeOutboundUrl

| EG-01 | blocks 127.0.0.1 |
| EG-02 | blocks metadata IP host |

**NEXT:** N-003

### P5-D-N-003 [IMPLEMENT] — wire TenantHttpProxy

**NEXT:** N-004

### P5-D-N-004 [IMPLEMENT] — Zibal adapter + mock spec PSP-01

**NEXT:** N-005

### P5-D-N-005 [IMPLEMENT] — Stripe v2 Account + AccountLink PSP-02

**NEXT:** N-006

### P5-D-N-006 [IMPLEMENT] — webhook HMAC ingress WH-01

**NEXT:** N-007

### P5-D-N-007 [TEST] — replay cache WH-02

**NEXT:** N-008

### P5-D-N-008 [IMPLEMENT] — Super Admin PSP status UI-03

**NEXT:** N-009

### P5-D-N-009 [TEST] — mock suite INT-01

**NEXT:** N-010

### P5-D-N-010 [TEST] — EX-D + enable P5-C gateway guard
