# P9 — Anti-hollow contract (agents)

```yaml
contract_id: P9-ANTI-HOLLOW-CONTRACT
pack_version: "1.0"
fail_token: P9_FAIL
authority: P9-BOOT-MANIFEST.yaml · P9-IMPLEMENTATION-TRUTH.md
```

> **Rule:** Redirect shims exist ≠ consolidation done. `p9:gate` green ≠ portal E2E proven.

---

## Proof tier enum

| Tier | Meaning | Counts toward P9 exit |
| ---- | ------- | --------------------- |
| **DOC** | Doc sync only | Partial |
| **DEV_STATIC** | `p9:gate` · ripgrep · pack integrity | Partial |
| **PACKAGE** | workspace package exists + apps import | Yes |
| **SURFACE** | web no public-auth · guard:p9-surface-boundary | Yes |
| **BEHAVIORAL** | portal/marketing/web tests green | Yes |
| **REGRESSION** | p6+p7+p8 gate | Required |

---

## Gate — proves vs does_not_prove

| Check | proves | does_not_prove |
| ----- | ------ | -------------- |
| `pnpm run p9:gate` | Doc pack + p8 regression + integrity | Packages wired in apps |
| `rg zero public-auth` | Static absence | Portal OTP E2E |
| Package scaffold only | Folder exists | M+P import from package |
| Delete orphan flow | File gone | Surface boundary complete |
| `guard:import-boundary` | Workspace edges | web forbidden guest-surface-host |
| Reading p9-app-fit | Scope | Implementation |

---

## Forbidden claims (`P9_FAIL`)

```yaml
forbidden_claims:
  - "P9 complete" when web still has app/api/public-auth/route.ts
  - "Consolidation done" because catalog redirects to portal
  - "Zero resolve-host-tenant in apps" including web operator map
  - guest-surface-host imported in apps/web
  - session-client in apps/marketing
  - Delete apps/web/app/catalog/** redirect pages
  - Cross-app BFF factory "for reuse" — portal sole owner
  - tenant_domains.surface in P9 (owner P10)
  - p9:gate PASS without deleting web public-auth when nano P9-1-N-001 open
  - Move pluginId hack to guest package instead of API-only
  - Skip P9-1-N-001 because portal has routes (web duplicate must go)
```

---

## Hollow patterns

| Pattern | Why hollow | Valid instead |
| ------- | ---------- | ------------- |
| Copy-paste package without deleting app duplicates | Two sources of truth | Delete local M+P files |
| Re-export web public-auth from portal | Still duplicate surface | Delete web routes |
| guest-surface-host includes web bootstrap | Boundary violation | M+P only |
| Remove all /catalog from web middleware | Breaks legacy URLs | Trim public-auth paths only |
| Mark G-BOOT-01 done with package empty | Scaffold hollow | M+P import + local files deleted |

---

## Agent workflow

```yaml
AGENT_WORKFLOW_LINEAR:
  1: READ P9-BOOT-MANIFEST T0
  2: RUN p8:gate — on_fail P9_FAIL
  3: DETECT current_nano
  4: DOC-FIRST if apps/api / workspace-sdk / platform-core
  5: LOAD VERIFICATION-COMMANDS#nano
  6: RUN commands + expect_token
  7: EMIT turn_report
  8: pnpm run p9:gate after code touch
```

---

## References

- [P9-EXECUTION-DISCIPLINE.md](P9-EXECUTION-DISCIPLINE.md)
- [P9-AGENT-TURN-SCHEMA.md](P9-AGENT-TURN-SCHEMA.md)
