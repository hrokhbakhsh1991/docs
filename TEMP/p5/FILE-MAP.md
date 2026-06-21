# P5 — FILE-MAP

```yaml
nano_total: 56
nano_done: 3
updated: 2026-06-21
```

| Nano | Type | Status | Primary files | Verify |
|------|------|--------|---------------|--------|
| P5-A-N-001 | IMPLEMENT | ✅ | `scripts/p4-club-product-gate.sh`, `scripts/p5-enterprise-evolution-gate.sh`… | GATE-01 covenant in p4/p5 gates |
| P5-A-N-002 | DOC | ✅ | `docs/phase-18/platform-metadata-cutover-pilot.mdoc`, `TEMP/p5/doc-scaffold/phase-18-outline.md` | DOC-01 phase-18 scaffold |
| P5-A-N-003 | IMPLEMENT | ✅ | `apps/api/src/workspace-metadata/derive-metadata-cutover-stage.ts`, `apps/api/src/platform/platform-tenant-workspace-definition.dto.ts`… | CO-01..04 stage derivation |
| P5-A-N-004 | IMPLEMENT | ⬜ | `apps/web/src/platform/club-workspace-tab.tsx`, `apps/web/test/platform-club-workspace-cutover-tab.spec.ts` | UI-01 cutover badge |
| P5-A-N-005 | DOC | ⬜ | `docs/phase-18/platform-metadata-cutover-pilot.mdoc` | DOC-02 staging env checklist |
| P5-A-N-006 | IMPLEMENT | ⬜ | `apps/api/src/observability/metrics.ts`, `apps/api/test/workspace-metadata-cutover-metrics.spec.ts` | MET-01 validation error counter |
| P5-A-N-007 | DOC | ⬜ | `docs/phase-18/platform-metadata-cutover-pilot.mdoc`, `apps/api/scripts/smoke-metadata-pilot-bind.mjs` | SMOKE-01 staging bind script |
| P5-A-N-008 | TEST | ⬜ | `apps/api/test/workspace-metadata-cutover-allowlist.spec.ts` | CO-05 rollback drill |
| P5-A-N-009 | TEST | ⬜ | `apps/api/test/platform-tenant-workspace-definition-audit.spec.ts` | AUD-01 uses TENANT_DEFINITION_* actions |
| P5-A-N-010 | DOC | ⬜ | `docs/phase-18/platform-metadata-cutover-pilot.mdoc` | DOC-03 expand allowlist runbook |
| P5-A-N-011 | DOC | ⬜ | `docs/phase-16/platform-workspace-cutover.mdoc`, `docs/phase-18/platform-metadata-cutover-pilot.mdoc` | DOC-04 G2 async validation note |
| P5-A-N-012 | DOC | ⬜ | `TEMP/p5/FILE-MAP.md` | sync map |
| P5-A-N-013 | IMPLEMENT | ⬜ | `scripts/p5-enterprise-evolution-gate.sh`, `package.json`… | GATE-02 p5:gate wired |
| P5-A-N-014 | TEST | ⬜ | `TEMP/p5-exit-checklist.md`, `TEMP/wizard-denali-enterprise-assessment.md` | EX-A P5-A exit |
| P5-B-N-001 | DOC | ⬜ | `docs/phase-18/platform-denali-operator-parity.mdoc` | DOC parity matrix |
| P5-B-N-002 | DOC | ⬜ | `docs/phase-18/platform-denali-operator-parity.mdoc` | matrix maps legacy gap IDs |
| P5-B-N-003 | IMPLEMENT | ⬜ | `apps/api/src/canonical/assert-tour-lifecycle-transition.ts`, `apps/api/test/tour-lifecycle-transition.spec.ts` | LC-01 transition matrix |
| P5-B-N-004 | IMPLEMENT | ⬜ | `apps/api/src/canonical/canonical-tour.service.ts`, `apps/api/test/tour-publish-transition.spec.ts` | LC-02 publish gates |
| P5-B-N-005 | IMPLEMENT | ⬜ | `apps/api/src/tours/canonical-validation-sync.ts`, `apps/api/test/canonical-validation-draft-vs-publish.spec.ts` | VAL-01 draft vs publish |
| P5-B-N-006 | TEST | ⬜ | `apps/api/test/workspace-metadata-denali-parity-publish.spec.ts` | RP-01 golden on metadata path |
| P5-B-N-007 | IMPLEMENT | ⬜ | `apps/api/src/canonical/strip-form-profile-for-submit.ts`, `apps/api/test/form-profile-strip.spec.ts` | VAL-02 profile strip |
| P5-B-N-008 | IMPLEMENT | ⬜ | `apps/api/src/canonical/assert-catalog-ref-integrity.ts`, `apps/api/test/catalog-ref-integrity.spec.ts` | VAL-03 catalog refs |
| P5-B-N-009 | IMPLEMENT | ⬜ | `apps/web/src/wizard/resolve-operator-workspace-plugin.ts`, `apps/web/test/operator-metadata-plugin-resolve.spec.ts` | WEB-01 metadata plugin in operator |
| P5-B-N-010 | TEST | ⬜ | `apps/api/test/denali-metadata-path-publish-integration.spec.ts` | E2E-01 publish on metadata path |
| P5-B-N-011 | IMPLEMENT | ⬜ | `apps/api/src/audit/audit-logger.ts`, `apps/api/test/tour-patch-audit.spec.ts` | AUD-02 PATCH audit |
| P5-B-N-012 | IMPLEMENT | ⬜ | `apps/api/test/tour-publish-audit.spec.ts` | AUD-03 publish audit |
| P5-B-N-013 | TEST | ⬜ | `packages/workspaces/denali/test/client-server-rules-parity.spec.ts` | RP-02 client/server rules |
| P5-B-N-014 | TEST | ⬜ | `TEMP/p5/PRESERVATION-CHECKLIST.md`, `apps/api/test/p5-preservation-gate.spec.ts` | PC-01..10 preservation gate |
| P5-B-N-015 | DOC | ⬜ | `TEMP/p5/FILE-MAP.md` | sync map |
| P5-B-N-016 | TEST | ⬜ | `apps/api/test/platform-denali-operator-parity-exit.spec.ts`, `TEMP/p5-exit-checklist.md` | EX-B P5-core exit |
| P5-C-N-001 | DOC | ⬜ | `docs/phase-18/platform-workspace-commerce.mdoc` | DOC commerce schema |
| P5-C-N-002 | IMPLEMENT | ⬜ | `packages/workspace-sdk/src/metadata/commerce-schema.ts` | SCH-01 zod commerce |
| P5-C-N-003 | IMPLEMENT | ⬜ | `apps/api/src/workspace-metadata/persist-commerce-on-publish.ts` | API-01 persist |
| P5-C-N-004 | IMPLEMENT | ⬜ | `apps/api/src/workspace-metadata/load-workspace-plugin-for-tenant.ts` | API-02 inherit defaults |
| P5-C-N-005 | IMPLEMENT | ⬜ | `apps/api/src/tours/tours.service.ts`, `apps/api/test/tour-create-payment-mode-default.spec.ts` | API-03 tour default |
| P5-C-N-006 | IMPLEMENT | ⬜ | `apps/web/src/platform/club-commerce-badge.tsx`, `apps/web/test/platform-club-commerce-badge.spec.ts` | UI-02 badge non-Denali only |
| P5-C-N-007 | TEST | ⬜ | `apps/api/test/workspace-commerce-single-mode.spec.ts` | GU-01 one mode |
| P5-C-N-008 | TEST | ⬜ | `apps/api/test/denali-offline-receipt-unchanged.spec.ts` | PC-07 Denali unchanged |
| P5-C-N-009 | TEST | ⬜ | `apps/api/test/workspace-commerce-gateway-blocked.spec.ts` | GU-02 gateway blocked until D |
| P5-C-N-010 | TEST | ⬜ | `apps/api/test/platform-workspace-commerce-exit.spec.ts` | EX-C optional exit |
| P5-D-N-001 | DOC | ⬜ | `docs/phase-18/platform-integrations-plane.mdoc` | DOC threat model |
| P5-D-N-002 | IMPLEMENT | ⬜ | `apps/api/src/integrations/egress/assert-safe-outbound-url.ts`, `apps/api/test/egress-url.spec.ts` | EG-01 port egress |
| P5-D-N-003 | IMPLEMENT | ⬜ | `apps/api/src/main.ts`, `apps/api/src/http/tenant-http-proxy.ts` | EG-02 wire proxy |
| P5-D-N-004 | IMPLEMENT | ⬜ | `apps/api/src/integrations/payments/zibal/`, `apps/api/test/zibal-adapter.spec.ts` | PSP-01 zibal mock |
| P5-D-N-005 | IMPLEMENT | ⬜ | `apps/api/src/integrations/payments/stripe-connect-v2/`, `apps/api/test/stripe-v2-account.spec.ts` | PSP-02 stripe v2 |
| P5-D-N-006 | IMPLEMENT | ⬜ | `apps/api/src/integrations/webhooks/payments-webhook.controller.ts` | WH-01 webhook ingress |
| P5-D-N-007 | TEST | ⬜ | `apps/api/test/payments-webhook-replay.spec.ts` | WH-02 replay cache |
| P5-D-N-008 | IMPLEMENT | ⬜ | `apps/web/src/platform/club-psp-status.tsx` | UI-03 PSP status |
| P5-D-N-009 | TEST | ⬜ | `apps/api/test/integrations-plane-mock.spec.ts` | INT-01 mock PSP suite |
| P5-D-N-010 | TEST | ⬜ | `apps/api/test/platform-integrations-plane-exit.spec.ts` | EX-D optional exit |
| P5-E-N-001 | DOC | ⬜ | `docs/phase-18/platform-registrations-finance-tranche.mdoc` | DOC scope |
| P5-E-N-002 | IMPLEMENT | ⬜ | `apps/api/src/registrations/registration-capacity.service.ts`, `apps/api/test/registration-capacity.spec.ts` | REG-01 capacity |
| P5-E-N-003 | IMPLEMENT | ⬜ | `apps/api/src/registrations/public-registration-throttle.ts` | REG-02 throttle |
| P5-E-N-004 | TEST | ⬜ | `apps/api/test/paid-tour-open-gate.spec.ts` | FIN-01 paid tour gate |
| P5-E-N-005 | IMPLEMENT | ⬜ | `apps/api/src/workspace-finance/tour-created-finance-side-effect.ts` | FIN-02 outbox hook |
| P5-E-N-006 | TEST | ⬜ | `apps/api/test/platform-registrations-finance-exit.spec.ts`, `TEMP/p5-exit-checklist.md` | EX-E full P5 exit |
