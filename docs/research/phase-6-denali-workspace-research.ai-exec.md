# AI-EXECUTION — Phase 6 Research (T0/T1 stub)

```yaml
agent_load_tier: T0
non_authoritative_for_execution: true
sole_execution_entry: docs/phase-6/phase-6-agent-router.md
research_body: docs/research/phase-6-denali-workspace-research.md
decisions: docs/phase-6/appendices/IMPLEMENTATION-DECISIONS.md
```

> **Do not implement from this file.** Load full research at **T3** only. Execution: [`phase-6-agent-router.md`](../phase-6/phase-6-agent-router.md).

---

## One-line goal

Port Denali into `packages/workspaces/denali` as `WorkspacePlugin` — **zero** Denali-only branches in `platform-core` / generic API.

---

## DAG (do not reorder)

`6.0 → 6.1 → 6.2 → {6.3 ∥ 6.4} → 6.5 → {6.6 ∥ 6.7} → 6.8 → 6.9`

---

## Forbidden (legacy failures — do not repeat)

| ID  | Rule                                               |
| --- | -------------------------------------------------- |
| F1  | `if (workspaceType === 'denali')` in platform-core |
| F2  | runtime `import` from `legacy/`                    |
| F3  | RHF + canonical dual SoT                           |
| F4  | second copy of registry in `apps/web`              |
| F5  | copy `legacy/apps/api/.../finance/**` tree         |
| F6  | new finance tables in generic `apps/api`           |
| F7  | dual-write `trip_details` + canonical              |
| F8  | leave `DENALI_BREACH_PROBE` as product             |

---

## Industry defaults (2025–2026)

| Topic        | Choose                                                                         |
| ------------ | ------------------------------------------------------------------------------ |
| Migration    | Strangler: facade route → ACL → shadow parity → flag ramp → delete legacy path |
| Plugin trust | First-party same-origin module; governance stays in core (Paperclip model)     |
| Events       | Domain outbox (Phase 5); plugin **consumes**; idempotent handlers              |
| Wizard       | Keep registry + codegen; canonical SoT only                                    |
| MinIO        | `{tenantId}/...` prefix; presigned; no public bucket                           |

---

## Phase 5 dependency honesty

| 5.x              | Blocks 6.x if missing                               |
| ---------------- | --------------------------------------------------- |
| 5.2 validate     | 6.2 rules integration                               |
| 5.3 projection   | 6.6 list parity                                     |
| 5.4 outbox relay | 6.4 finance (use stub + contract tests until green) |
| 5.5 audit        | compliance hooks optional in 6.4                    |

---

## Port source vs anti-pattern

| Port from                                       | Never copy                                         |
| ----------------------------------------------- | -------------------------------------------------- |
| `legacy/packages/denali-domain/`                | `legacy/apps/web/.../wizard/denali/` as second SoT |
| `emit-finance-ledger-journal-outbox.ts` pattern | full `modules/finance`                             |
| `packages/workspaces/starter` shell             | `WorkspaceStrategyRegistry` denali branches        |

---

## Creative tactics (approved for subphase depth)

- Golden canonical fixtures + snapshot tests (6.6)
- `denali.plugin.manifest.json` for contract guard
- ACL folder only for legacy shape mapping (6.2/6.8)
- Shadow validate mode (non-prod only)
- `denali:codegen` CI dirty check on `generated/`

---

## Verification covenant (MAP §12)

- Not grep-only: `phase-6.contract.spec.ts` + plugin `test/*.contract.spec.ts`
- HTTP/e2e for bootstrap + tenant boundary
- Forensic audit ≥ 8 at 6.9

---

## Links

| Layer         | Path                                                                           |
| ------------- | ------------------------------------------------------------------------------ |
| Research (T3) | [`phase-6-denali-workspace-research.md`](phase-6-denali-workspace-research.md) |
| Hub           | [`phase-6/README.md`](../phase-6/README.md)                                    |
| MAP § Phase 6 | [`MIGRATION-MAP.md`](../MIGRATION-MAP.md)                                      |
| Continuity    | [`PLATFORM-CONTINUITY-0-6.md`](../appendices/PLATFORM-CONTINUITY-0-6.md)       |
| Legacy map    | [`legacy/map.md`](../../legacy/map.md)                                         |

---

## Doc pack status (2026-06-04)

**Doc execution system: 96** — `pnpm run phase-6:guard` · [`DOC-EXECUTION-SCORECARD.md`](../phase-6/audits/DOC-EXECUTION-SCORECARD.md)

## Next work (code — not doc)

1. Implement from subphases starting 6.0
2. Repo behavioral remains ~0 until 6.1+
