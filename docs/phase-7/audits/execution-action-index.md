# Phase 7 — Execution action index

> **Registry:** [`../appendices/action-registry.md`](../appendices/action-registry.md)

| action_id | one_line                                        | REQ        |
| --------- | ----------------------------------------------- | ---------- |
| P7-0-A01  | Run phase-6:gate capture exit                   | REQ-P7-001 |
| P7-0-A02  | Update phase-7-entry-verified.yaml              | REQ-P7-002 |
| P7-0-A03  | Verify no URBAN in api core                     | REQ-P7-003 |
| P7-0-A04  | Assert zero legacy runtime imports              | REQ-P7-003 |
| P7-1-A01  | Scaffold @app-tour/workspace-urban package.json | REQ-P7-004 |
| P7-1-A02  | Implement getUrbanWorkspacePlugin               | REQ-P7-005 |
| P7-1-A03  | Add slim field registry + golden fixtures       | REQ-P7-031 |
| P7-1-A04  | Add theme/tokens.css ingress                    | REQ-P7-005 |
| P7-2-A01  | Record platform-core baseline SHA               | REQ-P7-006 |
| P7-2-A02  | Add phase-7.contract.spec.ts                    | REQ-P7-006 |
| P7-2-A03  | Verify git diff platform-core empty             | REQ-P7-007 |
| P7-3-A01  | Register urban in resolve-workspace-plugin.ts   | REQ-P7-009 |
| P7-3-A02  | Extend web workspace-plugin-registry            | REQ-P7-010 |
| P7-3-A03  | Add urban-workspace-binding contract test       | REQ-P7-009 |
| P7-3-A04  | Anti-rail guard P7-X-A02                        | REQ-P7-011 |
| P7-4-A01  | urban-workspace-plugin.spec.ts green            | REQ-P7-012 |
| P7-4-A02  | urban-create-publish.integration.spec.ts        | REQ-P7-013 |
| P7-4-A03  | Invalid itinerary fixture fails validation      | REQ-P7-014 |
| P7-5-A01  | Complete §10.2 log fields                       | REQ-P7-015 |
| P7-5-A02  | Publish OBSERVABILITY-RUNBOOK alerts            | REQ-P7-016 |
| P7-5-A03  | audit-log-fields.mjs green                      | REQ-P7-017 |
| P7-6-A01  | Redis rate limit middleware                     | REQ-P7-018 |
| P7-6-A02  | Tier caps env config                            | REQ-P7-019 |
| P7-6-A03  | rate-limit-tenant.spec.ts                       | REQ-P7-020 |
| P7-7-A01  | tenant_routes migration                         | REQ-P7-021 |
| P7-7-A02  | Extend TenantRoute + router impl                | REQ-P7-022 |
| P7-7-A03  | tenant-connection-router.spec.ts                | REQ-P7-023 |
| P7-8-A01  | Run ci:integrity                                | REQ-P7-024 |
| P7-8-A02  | Re-run P0 adversarial matrix                    | REQ-P7-025 |
| P7-8-A03  | Re-verify genericity guard                      | REQ-P7-026 |
| P7-9-A01  | phase-7:gate exit 0                             | REQ-P7-027 |
| P7-9-A02  | Forensic score ≥ 8                              | REQ-P7-029 |
| P7-9-A03  | Update IMPLEMENTATION-TRUTH closure             | REQ-P7-035 |
| P7-9-A04  | Platform DoD MAP checklist                      | REQ-P7-030 |
| P7-9-A05  | total-paranoid-audit if required                | REQ-P7-028 |
