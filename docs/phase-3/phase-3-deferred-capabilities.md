# Phase 3 — Deferred capabilities (explicit, non-blocking)

| ID | Capability | Phase 3 state | Phase owner |
|----|------------|---------------|-------------|
| GAP-3.3-04 | Dynamic plugin resolution by host/tenant | Static `listBootstrapWorkspacePlugins()` → starter only | 4.x tenant-kernel |
| GAP-3.2-04 | `DEV_TENANTS` production registry | Warn in prod; static array for scaffold | 4.x provisioning |
| GAP-3.2-03 | `@casl/prisma` runtime on queries | `accessibleByTourWhere` reference + scoped repo | 4.2 RLS |
| GAP-3.3-06 | Wizard `number` / `date` / `composite` | Read-only unsupported UI | 3.3.y / 6 |
| GAP-3.3-07 | `apps/web` transpilePackages whole `ui-primitives` | Imports remain subpath-only; ESLint + audit enforce | Accept |
| GAP-CI-01 | Count-only gate floors | Supplemented by contract specs in packages; full matrix Phase 4+ | Ongoing |

**Bootstrap contract (3.3.04):** `apps/web/src/bootstrap/workspace-plugins.ts` must not import `packages/workspaces/*` statically except via published `@app-tour/workspace-starter` until host resolver lands.
