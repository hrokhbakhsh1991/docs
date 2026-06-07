# Phase 8 — Doc execution scorecard

```yaml
scorecard_version: "2026-06-08-v1"
sprint: "Sprint A — Agent Readiness"
audit_pass: phase-8-doc-hardening
```

## Scores

| Metric                | Before Sprint A | After Sprint A | Target (8.5) |
| --------------------- | --------------- | -------------- | ------------ |
| Agent readiness       | **~72**         | **~88**        | **95**       |
| Doc execution system  | **~82**         | **~88**        | **96**       |
| Critical spec quality | **~85**         | **~90**        | **96**       |
| Repo behavioral       | **~0**          | **~0**         | honest       |

## Sprint A deliverables

| Component                                                             | Status |
| --------------------------------------------------------------------- | ------ |
| `AGENT-NAVIGATOR.md` + decision tree                                  | ✅     |
| `AGENT-CURRENT-PHASE.yaml` machine snapshot                           | ✅     |
| `verification-matrix.md` CMD blocks (copy-paste safe)                 | ✅     |
| `verification-commands.md` per subphase                               | ✅     |
| `IMPLEMENTATION-TRUTH` sync (8.0 entry · 8.1 active · scaffold table) | ✅     |
| `phase-7-bridge.md` + `adr-008.md` stubs                              | ✅     |
| `TEMP/phase8-wip-specs/README.md` T-8.1 promote train                 | ✅     |
| `p8_agent_navigator_present` guard (25 charter gates)                 | ✅     |

## Gaps to 95 (Sprint B+)

| Gap                                    | Mitigation                                 |
| -------------------------------------- | ------------------------------------------ |
| T-8.1 spec promote to trunk            | Separate PR — `cp` commands in TEMP README |
| `apps/api/src/urban/**` implementation | 8.1 behavioral PR after Architect YES      |
| ASM-8.2/8.4 + ERIP COP 8.2/8.3         | Sprint C doc pack                          |
| `test:e2e:urban` script                | 8.4 subphase                               |
| Forensic rubric ≥ 8 at 8.5             | `phase-8:gate` closure only                |

## Machine checks

```bash
pnpm run phase-8:guard
node scripts/guards/lib/phase-8-doc-hardening.mjs
```

**Note:** `p8_spec_path_registry` requires T-8.1 promote before full **25/25** in CI if scaffolds remain TEMP-only.

## Closure criteria (behavioral — not yet)

8.5 requires `phase-8:gate` + `phase-8.contract.spec.ts` green + subphases 8.1–8.4 `VERIFIED_BEHAVIORAL`.
