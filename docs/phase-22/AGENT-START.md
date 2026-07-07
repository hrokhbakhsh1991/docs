# P9 Agent — sole entry (pack v1.0 AI-hardened)

```yaml
phase: 22
pack: P9
pack_version: "1.0"
status: PLANNED
sole_boot: appendices/P9-BOOT-MANIFEST.yaml
fail_token: P9_FAIL
prerequisite: P8 exit · pnpm run p8:gate
current_task: P9-0-N-001
machine_snapshot: AGENT-CURRENT-PHASE.yaml
truth: appendices/P9-IMPLEMENTATION-TRUTH.md
anti_hollow: appendices/P9-ANTI-HOLLOW-CONTRACT.md
verification: appendices/P9-VERIFICATION-COMMANDS.yaml
turn_schema: appendices/P9-AGENT-TURN-SCHEMA.md
discipline: appendices/P9-EXECUTION-DISCIPLINE.md
boundaries: p9-package-boundary.yaml
app_fit: p9-app-fit.md
p9_gate: pnpm run p9:gate
exit_target: 8.7
```

> **Agents:** Boot **only** from [P9-BOOT-MANIFEST.yaml](appendices/P9-BOOT-MANIFEST.yaml). Redirect shims ≠ done.

---

## Pre-flight (T0 — every session)

```text
1. READ  appendices/P9-BOOT-MANIFEST.yaml
2. READ  p9-app-fit.md (web keeps operator host · catalog redirects KEEP)
3. READ  appendices/P9-IMPLEMENTATION-TRUTH.md
4. READ  appendices/P9-ANTI-HOLLOW-CONTRACT.md
5. READ  appendices/P9-EXECUTION-DISCIPLINE.md
6. READ  p9-package-boundary.yaml
7. READ  AGENT-CURRENT-PHASE.yaml
8. RUN    pnpm run p8:gate  (exit 0 or P9_FAIL)
9. LOAD   P9-VERIFICATION-COMMANDS.yaml#{current_task} only
10. END   turn with turn_report
```

---

## What P9 is

**Code consolidation** — `guest-surface-host` (M+P) · `session-client` (web+portal) · **delete web guest duplicate** · boundary guards.

**Not:** TLS (P10) · ingress DB (P10) · remove catalog redirect shims.

| EPIC | One line |
| ---- | -------- |
| P9-0 | packages + M+P dedup |
| P9-1 | web guest cleanup (not redirect pages) |
| P9-2 | API-only pluginId |
| P9-3 | guard · doc · e2e · p9:gate |

---

## Agent loop

```text
detect_current_nano
  → doc-first if api/packages
  → LOAD verification YAML#nano only
  → RUN commands · expect_token
  → pnpm run p9:gate if code changed
  → UPDATE IMPLEMENTATION-TRUTH on PACKAGE/SURFACE+ PASS
  → EMIT turn_report (mandatory)
```

---

## Gates

```bash
pnpm run p8:gate    # prerequisite every session
pnpm run p9:gate    # after any P9 code touch
pnpm run guard:import-boundary
pnpm run guard:p9-surface-boundary  # after P9-3-N-001
```

---

## Forbidden (P9_FAIL)

```text
❌ Start before p8:gate green
❌ guest-surface-host in web
❌ Delete web /catalog redirect pages
❌ Zero resolve-host-tenant in web (operator map stays)
❌ session-client in marketing
❌ tenant_domains.surface (P10)
❌ p9:gate PASS while web public-auth routes exist
```

---

## Status

**Current nano:** `P9-0-N-001` · [AGENT-CURRENT-PHASE.yaml](AGENT-CURRENT-PHASE.yaml)
