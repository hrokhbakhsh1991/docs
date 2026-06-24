# P7 Agent — sole entry (pack v1.6 AI-hardened)

```yaml
phase: 20
pack: P7
pack_version: "1.6"
status: STAGING_COMPLETE
sole_boot: appendices/P7-BOOT-MANIFEST.yaml
fail_token: P7_FAIL
prerequisite: P6 complete (pnpm run p6:gate)
current_task: P7-3-N-005
next_manual: runbooks/p7-t4-sign-off-session.md
exit_handoff: P7-EXIT-HANDOFF.md
machine_snapshot: AGENT-CURRENT-PHASE.yaml
truth: appendices/IMPLEMENTATION-TRUTH-P7.md
anti_hollow: appendices/P7-ANTI-HOLLOW-CONTRACT.md
verification: appendices/P7-VERIFICATION-COMMANDS.yaml
turn_schema: appendices/P7-AGENT-TURN-SCHEMA.md
p7_gate: pnpm run p7:gate
```

> **Agents:** Boot **only** from [P7-BOOT-MANIFEST.yaml](appendices/P7-BOOT-MANIFEST.yaml). Deprecated paths → [P7-DEPRECATED-ENTRYPOINTS.md](appendices/P7-DEPRECATED-ENTRYPOINTS.md).

---

## Pre-flight (T0 — every session)

```text
1. READ  appendices/P7-BOOT-MANIFEST.yaml
2. READ  appendices/IMPLEMENTATION-TRUTH-P7.md
3. READ  appendices/P7-ANTI-HOLLOW-CONTRACT.md
4. READ  AGENT-CURRENT-PHASE.yaml → current_task
5. RUN    pnpm run p6:gate  (exit 0 or P7_FAIL — stop P7 work)
6. LOAD   P7-VERIFICATION-COMMANDS.yaml#{current_task} only
7. END    turn with P7-AGENT-TURN-SCHEMA.md turn_report
```

---

## What P7 is

**First Denali customer on staging** — P6 closed the product chain in dev; P7 proves VS-01..08 on real infra.

**Not:** new product · refactor · gateway · wizard rebuild.

| EPIC | One line |
| ---- | -------- |
| P7-0 | four-process staging + seed + env |
| P7-1 | complete existing wizard/settings (P0 only) |
| P7-2 | workspace ops — additive + conditional |
| P7-3 | T2/T3/T4 verify + sign-off |

---

## Agent loop (one nano per turn)

```text
detect_current_nano (BOOT-MANIFEST)
  → LOAD verification YAML for that nano only
  → doc-first if code touch (api/web/denali)
  → RUN commands · capture expect_token
  → pnpm run p7:gate if code changed
  → UPDATE staging column ONLY on STAGING+ PASS
  → EMIT turn_report (mandatory)
```

---

## Load tiers

| Tier | Files |
| ---- | ----- |
| **T0** | BOOT-MANIFEST · TRUTH · ANTI-HOLLOW · AGENT-CURRENT-PHASE |
| **T1** | VERIFICATION-COMMANDS#nano · EPIC spec for nano · linked runbook |
| **T2** | TRACEABILITY · TEST-INVENTORY · SMOKE-MAP · FILE-MAP |

Do **not** bulk-read all EPIC specs or umbrella mdoc at boot.

---

## Gates

```bash
pnpm run p7:gate              # every PR — DEV_STATIC (or P7_FAST=1 on verify scripts)
pnpm run p7:staging-remote-smoke   # fast VPS smoke (~5s) — no p7:gate
pnpm run p7:staging-gate      # after deploy — STAGING (slow · TEMP/FOR YOU.md)
pnpm run p7:evidence-pack-verify  # T4 manifest
```

---

## Zones

- **Z1 Freeze:** wizard · rules · composites
- **Z2 Complete:** same step/field fixes
- **Z3 Additive:** workspace paths only
- **Z4 Later:** [POST-P7-HORIZON.md](appendices/POST-P7-HORIZON.md)

---

## Navigator

Decision tree → [../AGENT-NAVIGATOR.md](../AGENT-NAVIGATOR.md)

---

## Status

**Current nano:** `P7-1-N-003` (blocked by **BLK-P7-00**) · Fix: denali tsc green → `pnpm run p7:sync-staging-web`
