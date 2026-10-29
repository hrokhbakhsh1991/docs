# Denali second-tenant staging runbook

**Status: DRAFT — P7-04 is not closed.** This runbook records the verified deployment path and safe diagnostics. Authenticated acceptance, a repeatable one-command tenant matrix, artifact-aware rollback, and TLS renewal operations must be proven before this document is an operational sign-off.

## Scope and current evidence

This runbook is for the isolated Denali staging tenants A and B. It is not a production deployment or a production recovery procedure. The evidence ledger and scenario matrix are the source of current status:

- [Execution ledger](denali-second-tenant-staging-execution-ledger.md)
- [Machine-readable evidence](denali-second-tenant-staging-evidence.json)
- [Original execution plan](denali-second-tenant-staging-plan.md)

At the latest successful runtime observation, staging ran release SHA `3d51cf665b56cd3cc25d12834b0ac02229f1a281`; six private host mappings and strict TLS/browser surface loads passed, but B Owner authentication failed with `AUTH_TENANT_HOST_MISMATCH`. A later local SSH refresh could not connect because `VPS_HOST` was not present in that shell, so revalidate runtime after the next deploy before relying on that SHA or service state.

## Supported deployment path

The repository workflow is [deploy-staging.yml](../../.github/workflows/deploy-staging.yml):

1. Merge the reviewed PR to `dev` only after the exact PR head has passing required checks and the requested independent review is complete.
2. A push to `dev` runs the staging workflow. The current auth branch cannot use manual staging dispatch; that path is restricted to `codex/denali-final-approval-e2e` and verifies the exact open PR head and preflight checks.
3. The workflow builds and uploads an immutable artifact with release SHA and digest, installs it through `scripts/vps-deploy/deploy-staging-artifact-remote.sh`, then runs the four-process smoke, app-role RLS catalog verification, and the workspace staging adapter.
4. Record the workflow run URL, artifact digest, release SHA, `/opt/app-tour-staging/current` target, migration result, service health, and RLS result in the ledger. A green health check alone does not prove tenant behavior.

Do not copy a working tree directly to the staging host or put secrets in the ledger, artifact names, screenshots, or terminal output.

## Read-only health checks

The standard workflow runs the four-process smoke with `UNIT_PREFIX=app-tour-staging`. On the VPS, the script is installed under `/opt/app-tour-staging/tooling/scripts/vps-deploy/smoke-four-process.sh`; the documented invocation is:

```bash
ENV_DIR=/etc/app-tour-staging \
UNIT_PREFIX=app-tour-staging \
bash /opt/app-tour-staging/tooling/scripts/vps-deploy/smoke-four-process.sh
```

This checks API, web, marketing, and portal process health. The deploy workflow separately runs `scripts/vps-deploy/verify-staging-rls-remote.sh` using the staging app role. Capture the current release target and service statuses without printing environment files or database URLs.

## Tenant acceptance

Use the exact scenario statuses and evidence fields in `denali-second-tenant-staging-evidence.json`. Before claiming runtime PASS, the full acceptance runner must exercise the real staging app role and middleware, both tenant IDs, strict TLS, browser-visible login, and owner read-back for each mutation. It must cover all 18 `S2-E` cases, independently verify test/runtime SHA plus artifact digest and `runId`, and leave no failure hidden as a skip.

The repository has a targeted six-check Playwright network/TLS runner. Run it only from a clean checkout and provide an approved manifest that declares the exact six origins, ingress IP allowlist, tenant IDs, and runtime SHA, plus a unique `runId` and the exact checked-out test SHA. The config records the supplied SHA values; it does not derive them from Git or independently compare the served runtime to the manifest. Run from the repository root:

```bash
DENALI_TWO_TENANT_STAGING_MANIFEST=/path/to/approved-manifest.json \
DENALI_TWO_TENANT_RUN_ID=unique-run-id \
DENALI_TWO_TENANT_TEST_SHA=0123456789abcdef0123456789abcdef01234567 \
pnpm --filter @apps/web exec playwright test \
  --config playwright.two-tenant-staging.config.mts
```

The command runs `apps/web/tests/e2e/two-tenant-staging-network.spec.ts` serially for A/B × marketing/admin/portal. It checks DNS against the manifest allowlist, strict Node/API TLS and HTTP, and browser navigation without TLS bypass; its reporter writes only under `apps/web/test-results/two-tenant-staging/<runId>`. The spec requires API and final browser responses below 400 (redirects are allowed for the API probe; browser navigation follows redirects). This still does not prove tenant identity or business behavior. A PASS from this runner is limited to those six network/TLS/page-load checks: it does not authenticate, assert the resolved tenant ID or served runtime SHA, test business isolation, or cover all 18 scenarios. The generic `pnpm run p7:staging-gate` and `scripts/p7-staging-remote-gate.sh` also do not cover the full matrix; the remote full-gate path disables SSH host-key checking and is not approved as its secure runner. **A repeatable command that executes and records the complete 18-case staging acceptance matrix is still unavailable or unverified.**

## TLS operations

The private `.staging.test` surfaces use `tls internal` in [the Caddyfile](../../deploy/vps/caddy/Caddyfile); keep origin port 443 private and use strict hostname and certificate validation with the scoped Caddy root CA in the isolated runner. Caddy documents that it manages certificate renewal automatically. For its internal CA, the documented defaults are 12-hour leaf certificates, a 7-day intermediate that renews automatically, and a 3600-day root; the root key and CA state must remain in persistent, protected Caddy storage. Recreating that storage can replace the root and invalidate the isolated runner's trust. See [Caddy Automatic HTTPS](https://caddyserver.com/docs/automatic-https) and its [`tls` directive](https://caddyserver.com/docs/caddyfile/directives/tls).

Read-only renewal check from the isolated runner (repeat for all six hosts). `CADDY_ROOT_CERT` must point to the exported public root certificate, and `STAGING_ORIGIN_IP` to the approved private origin:

```bash
set -euo pipefail
: "${CADDY_ROOT_CERT:?set path to the exported public Caddy root certificate}"
: "${STAGING_ORIGIN_IP:?set approved private staging origin IP}"
for host in \
  admin.denali.staging.test denali.staging.test portal.denali.staging.test \
  admin.qa2.staging.test qa2.staging.test portal.qa2.staging.test; do
  openssl s_client \
    -connect "${STAGING_ORIGIN_IP}:443" \
    -servername "$host" \
    -verify_hostname "$host" \
    -verify_return_error \
    -CAfile "$CADDY_ROOT_CERT" \
    -showcerts </dev/null 2>/dev/null |
    sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' |
    openssl x509 -noout -checkend 3600 -subject -issuer -dates
done
```

Also check `systemctl is-active caddy` and `journalctl -u caddy -n 100 --no-pager`; do not expose the internal CA private key or install its root into the workstation-wide trust store. The repository has no configured certificate-expiry alert, named renewal owner, or recorded renewal-failure drill. Caddy's automatic behavior and this read-only check do not close those operational requirements; keep TLS operations open until the owner and alert/escalation route are assigned and a renewal/recovery drill is recorded.

Never disable TLS verification to make a browser or API probe pass.

## Recovery and rollback

The generic `scripts/vps-deploy/rollback-vps.sh` expects a Git checkout and is not a verified rollback for the immutable staging release layout. `scripts/vps-deploy/recover-vps-staging.sh` stops both production and staging units and is reserved for explicitly approved emergency recovery; do not use it for routine tenant rollback.

**No artifact-aware staging rollback has been rehearsed.** Before P7-02 can close, implement and review a rollback that selects a known release SHA under `/opt/app-tour-staging/releases`, captures and restores only task-owned configuration, handles the forward database schema explicitly, restarts only staging services, and proves post-rollback A smoke and restoration fingerprints. Do not run code-only rollback with schema/data assumptions left implicit.

## Current blockers to operational sign-off

- PR #336 CI and independent review must finish before merge and deploy.
- Post-fix B Owner login, A regression, role/session isolation, and the business acceptance matrix must pass on the installed artifact.
- A repeatable acceptance command, artifact-aware rollback rehearsal, TLS renewal procedure/drill, and final code/standards review remain open.
