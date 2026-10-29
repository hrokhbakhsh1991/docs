# Denali second-tenant staging runbook

**Status: DRAFT — P7-04 is not closed.** This runbook records the verified deployment path and safe diagnostics. Authenticated acceptance, a repeatable one-command tenant matrix, artifact-aware rollback, and TLS renewal operations must be proven before this document is an operational sign-off.

## Scope and current evidence

This runbook is for the isolated Denali staging tenants A and B. It is not a production deployment or a production recovery procedure. The evidence ledger and scenario matrix are the source of current status:

- [Execution ledger](denali-second-tenant-staging-execution-ledger.md)
- [Machine-readable evidence](denali-second-tenant-staging-evidence.json)
- [Original execution plan](denali-second-tenant-staging-plan.md)

At the latest successful runtime observation, staging runs release SHA `52aad2eed33ea35925ebba9abcda79c1ae2a095e`. PR #336 merged to `dev`; deploy workflow `40890782155` completed successfully with artifact digest `6190e1a61f25bbb1026d471938e2a89dec12795d6532794cfd64719abfeb031f`; migrations, four-process health, app-role RLS and workspace adapter passed. The current symlink and all four service process working directories resolve to the exact deployed release SHA. The official six-check network/TLS/browser runner passed on test SHA `0f08b79eff02c129f78fe36e6c134b9367470585` (`runId=local-stg-20261029-0f08b79e1`); fresh staging API probes mapped all six hosts to the expected A/B tenant IDs. A bubblewrap-scoped host map routed browser/API requests through the SSH/Caddy bridge with strict certificate verification and no TLS bypass. System DNS on the workstation and VPS still does not resolve the private `.staging.test` names. During this run the Caddy root was temporarily added to the local user's NSS trust database and removed afterward; repeat acceptance should move this trust into a dedicated browser profile before P4-02 operational sign-off. B Owner, Finance/Admin, and Member authentication plus B→A session-denial checks have passed through their respective strict-TLS BFF paths; a synthetic A Member login and A→B replay denial now also pass. A Owner/Finance coverage and business acceptance remain open.

## Supported deployment path

The repository workflow is [deploy-staging.yml](../../.github/workflows/deploy-staging.yml):

1. Merge the reviewed PR to `dev` only after the exact PR head has passing required checks and the requested independent review is complete.
2. A push to `dev` runs the staging workflow. The current auth branch cannot use manual staging dispatch; that path is restricted to `codex/denali-final-approval-e2e` and verifies the exact open PR head and preflight checks.
3. The workflow builds and uploads an immutable artifact with release SHA and digest, installs it through `scripts/vps-deploy/deploy-staging-artifact-remote.sh`, then runs the four-process smoke, app-role RLS catalog verification, and the workspace staging adapter.
4. Record the workflow run URL, artifact digest, release SHA, `/opt/app-tour-staging/current` target, migration result, service health, and RLS result in the ledger. A green health check alone does not prove tenant behavior.

Do not copy a working tree directly to the staging host or put secrets in the ledger, artifact names, screenshots, or terminal output.

## Fixture and cleanup preflight

Pin staging preflight to the installed immutable release rather than `current` when recording provenance. Omitting `--apply` is a dry-run; it does not mutate staging. The fixture preview validates its arguments and target configuration, then prints the proposed deterministic fixture counts. It does **not** query the database or prove that rows exist:

```bash
RELEASE=/opt/app-tour-staging/releases/52aad2eed33ea35925ebba9abcda79c1ae2a095e
"$RELEASE/bin/seed-denali-second-staging-fixtures.sh" --run-id qa2-20261029-postfix-r1
```

The cleanup preview is stronger: it reads the supplied manifest, validates its task-owned IDs and tenant scope, and checks live database rows/dependencies. It performs no deletes unless `--apply` is explicitly supplied. Record the returned counts and preserved categories; do not treat a fixture preview as DB verification.

```bash
"$RELEASE/bin/cleanup-denali-second-staging-fixtures.sh" \
  --manifest /etc/app-tour-staging/denali-second-staging-manifests/qa2-20261029-acceptance-01.json
```

The 2026-10-29 run returned 2 registrations, 2 tours and 5 resources and confirmed tenant, identities, wizard template and other tenant data were preserved. Both commands were pinned to release SHA `52aad2eed33ea35925ebba9abcda79c1ae2a095e`; neither used `--apply`. For a new fixture apply, use a unique run ID, retain the emitted manifest through a restrictive file mode, checksum it, and validate it with cleanup dry-run before any cleanup apply.

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

The repository has a targeted six-check Playwright network/TLS runner. Run it only from a clean checkout and provide an approved manifest that declares the exact six origins, ingress IP allowlist, tenant IDs, and runtime SHA, plus a unique `runId` and the exact checked-out test SHA. The runner now rejects any dirty/untracked checkout and verifies the declared test SHA against Git HEAD. The runtime SHA remains an approved-manifest value and is not independently attested by the served application. Run from the repository root:

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

On the staging VPS, the artifact API listens on loopback port `23001`; port `3001` belongs to the separate non-staging `app-tour-api.service` and must not be used as staging evidence. Read-only host mapping uses `GET http://127.0.0.1:23001/public/tenant-context` with explicit `Host`, `X-Forwarded-Host`, and `X-Forwarded-Proto: https` headers. Current six-host results are recorded in the execution ledger. Direct `curl` to this loopback endpoint is API integration evidence; it does not replace browser acceptance through the strict-CA Caddy ingress.

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

On 2026-10-29, strict `openssl s_client` checks from the staging VPS verified hostname, CA chain, and more than one hour of remaining validity for all six hosts. Each leaf reported `notAfter=Oct 30 00:03:51 2026 UTC`. This is a point-in-time health result, not a renewal/recovery drill. No certificate was renewed or allowed to expire; expiry alerting, named ownership and a recovery route remain unverified.

Also check `systemctl is-active caddy` and `journalctl -u caddy -n 100 --no-pager`; do not expose the internal CA private key or install its root into the workstation-wide trust store. The repository has no configured certificate-expiry alert, named renewal owner, or recorded renewal-failure drill. Caddy's automatic behavior and this read-only check do not close those operational requirements; keep TLS operations open until the owner and alert/escalation route are assigned and a renewal/recovery drill is recorded.

Never disable TLS verification to make a browser or API probe pass.

## Recovery and rollback

The generic `scripts/vps-deploy/rollback-vps.sh` expects a Git checkout and is not a verified rollback for the immutable staging release layout. `scripts/vps-deploy/recover-vps-staging.sh` stops both production and staging units and is reserved for explicitly approved emergency recovery; do not use it for routine tenant rollback.

**No artifact-aware staging rollback has been rehearsed.** Before P7-02 can close, implement and review a rollback that selects a known release SHA under `/opt/app-tour-staging/releases`, captures and restores only task-owned configuration, handles the forward database schema explicitly, restarts only staging services, and proves post-rollback A smoke and restoration fingerprints. Do not run code-only rollback with schema/data assumptions left implicit.

## Current blockers to operational sign-off

- Deploy workflow 40890782155 completed successfully including transfer/install/migration/standard seed, four-process health, app-role RLS and workspace adapter. The official six-case manifest runner and fresh host-to-tenant probes pass through a process-isolated resolver/tunnel; system DNS remains unavailable. Use a dedicated browser trust profile on the next run to close the remaining P4-02 trust-isolation requirement.
- A Owner/Finance login, refresh/returnTo, Finance business access, and the complete business acceptance matrix remain open. Synthetic A Member login and A→B portal replay denial are verified. The reserved A test-identity namespace contains Member/Viewer fixtures but no Owner/Finance fixture; the existing identity seeder is B-only, so do not use the non-test A Owner. A separately guarded A Owner/Finance seed and cleanup path now exists in the worktree, but is not included in the current deployed artifact or runtime-verified. The current B Finance team login is accepted, while the generic owner-panel session route correctly denies its non-owner role.

## A Owner/Finance task identities

The worktree now contains a guarded, artifact-bundled seed path for synthetic A Owner and Finance identities. It uses fixed reserved user IDs, resolves mobiles only from `DENALI_FIRST_STAGING_OWNER_MOBILE` and `DENALI_FIRST_STAGING_FINANCE_MOBILE`, rejects cross-tenant memberships and identity/mobile collisions, and requires `DENALI_FIRST_STAGING_IDENTITIES_CONFIRM=seed-denali-a-identities-to-tour_db_staging` for apply. The seed also refuses to add accounts whose mobile has pre-existing OTP challenges. **This is local source/test evidence only; the current staging release does not contain these entrypoints yet, and no A Owner/Finance account has been created.**

After a release containing these files is installed, first run the wrapper from the release symlink without `--apply`:

```bash
RELEASE=/opt/app-tour-staging/current
"$RELEASE/bin/seed-denali-first-staging-identities.sh"
```

The matching cleanup preview is database-backed and read-only. Cleanup apply requires `DENALI_FIRST_STAGING_IDENTITIES_CLEANUP_CONFIRM=cleanup-denali-a-identities-from-tour_db_staging`; it removes only the exact A memberships and OTP challenges for these configured identities. It deletes global user rows only when a Prisma schema-wide scan finds no other model fields ending in `UserId` that reference those IDs. If business or audit history references an identity, cleanup retains the user row for attribution while removing its A membership, so that the account cannot authenticate into the tenant. Do not treat that retained global row as full identity-row deletion.

```bash
"$RELEASE/bin/cleanup-denali-first-staging-identities.sh"
```

- A repeatable acceptance command, artifact-aware rollback rehearsal, TLS renewal procedure/drill, and final code/standards review remain open.

## Post-deploy runtime access status

The official deploy passed on SHA `52aad2eed33ea35925ebba9abcda79c1ae2a095e`. Runner `local-stg-20261029-0f08b79e1` passed all six strict-TLS API/browser page checks on test SHA `0f08b79eff02c129f78fe36e6c134b9367470585`. The current staging API on port `23001` returned the expected A/B tenant UUIDs for all six hosts; the root CA SHA-256 fingerprint was verified. The DNS override was confined to bubblewrap and the Caddy trust entry removed after the run; system DNS remains unresolved. The browser trust entry was temporary but used the local user's NSS store, so repeat with a dedicated profile before claiming P4-02 fully closed. Separately, strict-TLS BFF auth confirmed B Owner, Finance/Admin, and Member roles; B Owner/Member sessions were denied or marked not ready when replayed at A hosts, and a synthetic A Member session was marked not ready when replayed at B. This network runner itself does not test login, roles, or data isolation. The remaining path is A Owner/Finance coverage, refresh/returnTo and business isolation, then the complete 18-case acceptance command, artifact-aware rollback, and TLS operations drill.
