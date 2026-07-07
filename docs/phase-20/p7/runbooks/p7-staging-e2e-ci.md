# P7 — Staging E2E in CI (workflow_dispatch)

```yaml
runbook_id: P7-STAGING-E2E-CI
pack_version: "1.6"
authority: p7-staging-e2e.md · .github/workflows/p7-staging-gate.yml
decision: DEC-P7-014
```

> **Scope:** Remote **staging gate** (T1+infra+T3) via SSH — not full Playwright T2 in GHA (browsers need staging URLs + secrets).

---

## Workflows

| Workflow | Trigger | Action |
| -------- | ------- | ------ |
| [p7-staging-gate.yml](../../../.github/workflows/p7-staging-gate.yml) | `workflow_dispatch` | SSH → `pnpm run p7:staging-gate` on VPS |
| [deploy-vps.yml](../../../.github/workflows/deploy-vps.yml) | push `main` | deploy · then run staging gate manually |

---

## Secrets (GitHub repository)

| Secret | Purpose |
| ------ | ------- |
| `VPS_HOST` | Staging server IP |
| `VPS_SSH_KEY` | Deploy key |
| `VPS_USER` | optional · default `root` |
| `VPS_DEPLOY_PATH` | optional · default `/opt/app-tour` |

`DATABASE_URL` for T3 lives on VPS `/etc/app-tour/api.env` — not in GHA.

---

## Manual dispatch

1. GitHub → Actions → **P7 Staging Gate** → Run workflow
2. Optional input: `deploy_path` (default `/opt/app-tour`)
3. Expect job log ending with `P7_STAGING_GATE_OK`

---

## Local equivalent

```bash
bash scripts/p7-staging-remote-gate.sh
# or on VPS directly:
TOUR_OPS_API_URL=http://127.0.0.1:3001 pnpm run p7:staging-gate
```

---

## T2 Playwright in CI (deferred)

Full T2 requires:

- `PW_EXTERNAL_SERVERS=1`
- `SMOKE_*_BASE_URL` pointing at reachable staging IP
- Playwright browsers on runner **or** self-hosted runner on VPS

**Policy:** T2 remains [p7-staging-e2e.md](p7-staging-e2e.md) manual until Architect enables self-hosted E2E job. Do not block 98 on CI T2 if manual T2 log is in evidence pack.

---

## References

- [P7-EVIDENCE-PACK.md](../appendices/P7-EVIDENCE-PACK.md)
- [p7-staging-gate.md](p7-staging-gate.md)
