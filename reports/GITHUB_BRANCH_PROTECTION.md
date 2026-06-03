# GitHub — Phase 0 CI & branch protection (P0-OPS-01 / P0-OPS-03)

**Workflow:** [`.github/workflows/phase-0-gate.yml`](../.github/workflows/phase-0-gate.yml)

| Job | Required for merge? | Command parity |
|-----|---------------------|----------------|
| **Phase 0 foundation gate** | **Yes** (recommended) | `pnpm run phase-0:foundation-gate` |
| **Phase 0 integration gate** | Team policy (trunk integrity) | `pnpm run phase-0:integration-gate` |

## Steps (human / admin)

1. Push branch with Phase 0 fixes to `origin` and open PR → `main`.
2. Confirm both jobs green under **Actions** → `phase-0-gate`.
3. **Settings → Branches → Branch protection** for `main`:
   - Require status check: **Phase 0 foundation gate** (exact job name from workflow).
   - Optionally also: **Phase 0 integration gate**.
4. Save; re-run failed jobs if cache/Node drift.

## Local verification (before push)

```bash
nvm use 24
export PATH="$(dirname "$(nvm which 24)"):$PATH"
cd /home/hamed/Music/docs
pnpm run phase-0:gate
```

## PR hygiene (§12 #8)

```bash
gh pr list --state open   # no out-of-scope Phase 1–3-only PRs blocking Phase 0 closure
```
