# Phase 10 Charter — Workspace Host (Plugin-Native)

> **Status:** Phases 10.0–10.5 **DONE** · 10.6 DEC locked · 10.7 enforcement active  
> **North star:** New workspace = `package + manifest + codegen + tenant` — **~2** trunk touch points

## Delivered

| Subphase | Outcome |
| -------- | ------- |
| 10.1 | Outbox transport-only; finance side effect via dispatcher |
| 10.2 | `workspace.manifest.json` + `generate:workspace-registry` |
| 10.3 | Urban HTTP registrar + package `http/` module |
| 10.4 | Finance registrar + web loader codegen |
| 10.5 | SDK product-neutral auth + string-literal bindings |
| 10.6 | Data-layer DEC (no schema churn) |
| 10.7 | `workspace:create` + `phase-10:guard` |
| P3-T11 | `apps/api/src/urban/` shims removed — host wiring in `http/configure-urban-http-host.ts` |

## Commands

```bash
pnpm run generate:workspace-registry      # after manifest change
pnpm run workspace:create -- <id>         # scaffold new workspace package
pnpm run phase-10:guard                   # host invariants (fast)
pnpm run guard:architecture               # depcruise
```

## 9.5+ acceptance matrix

| Criterion | Guard |
| --------- | ----- |
| No direct `get*WorkspacePlugin` in API except generated | `guard-workspace-registry-imports` |
| Generated registry committed | `generate:workspace-registry --check` |
| `outbox-relay` product-free | `phase-10:guard` |
| `app.ts` product-path-free | `phase-10:guard` |
| SDK src product-neutral | `product-neutral-core.contract.spec.ts` |

## References

- RFC: [`workspace-host-contract-v2.md`](workspace-host-contract-v2.md)
- Execution roadmap: `TEMP/platform-plugin-native-remediation-roadmap.md` (historical local scratch `platform-plugin-native-remediation-roadmap.md`; not fresh-clone authority — see docs/audits/snapshots/2026-07-31/psr-2b-temp-authority-inventory.yaml)
