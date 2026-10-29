# Denali second-tenant staging runbook

**Status: DRAFT — P7-04 is not closed.** This runbook records the verified deployment path and safe diagnostics. Authenticated acceptance, a repeatable one-command tenant matrix, artifact-aware rollback, and TLS renewal operations must be proven before this document is an operational sign-off.

## Scope and current evidence

This runbook is for the isolated Denali staging tenants A and B. It is not a production deployment or a production recovery procedure. The evidence ledger and scenario matrix are the source of current status:

- [Execution ledger](denali-second-tenant-staging-execution-ledger.md)
- [Machine-readable evidence](denali-second-tenant-staging-evidence.json)
- [Original execution plan](denali-second-tenant-staging-plan.md)

At the latest successful runtime observation, staging runs release SHA `55a7085ddf52a5c7b90e29da46c2226649daf73e`. Deploy workflow `40931409066` succeeded with artifact digest `sha256:5597bda7cb7dd3f4f99ec5eb48a58c6c1a53f96eb92604095d0fe9373ac43f6a`; migrations, four-process health, app-role RLS and workspace adapter passed. The current symlink and all four service process working directories resolve to that exact release. The six-check strict-TLS runner passed on test SHA `64936efabc735b047ccf39606ae2c0705853b203` (`runId=local-stg-20261029-64936efab2`); fresh staging API probes mapped all six hosts to the expected A/B tenant IDs. The host map was confined to a process-isolated resolver and Chrome trust used a temporary dedicated NSS profile; no TLS bypass was used. System DNS on the workstation and VPS still does not resolve the private `.staging.test` names. B Owner, Finance/Admin, and Member authentication plus replay-denial checks and synthetic A Member login/replay denial are historical evidence on SHA `52aad2e`. Fresh strict-CA A Owner and Finance logins now pass on SHA `55a7085`; Owner session and Finance ability-context read-back match their exact A identities and roles. S2-E05 list/search/filter/pagination/count isolation now passes on SHA `55a7085` using authenticated A/B owners, exact B fixture IDs, matching per-tenant DB counts, and strict CA; sanitized detail is in `evidence/denali-second-tenant-staging/s2-e05-20261029.json`. E06 has an Owner-only finance invoice positive/negative boundary check; registration and receipt paths remain open. Finance/Admin receives the expected `AUTH_OWNER_PANEL_ONLY` on protected web BFF paths under locked DEC-P9-018; Finance API's separate admin/owner policy does not grant the current web panel. Current-release Member/browser replay and wider business acceptance remain open.

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

## S2-E04 A-side draft-tour fixture

The current staging release is SHA `55a7085ddf52a5c7b90e29da46c2226649daf73e`; it does not contain the new A-only S2-E04 draft-tour seed/cleanup entrypoints. Do not run the following until a reviewed artifact containing both wrappers is deployed and its release manifest/self-check confirms them. Local tests and a dry-run do not create the fixture or prove cross-tenant behavior.

After that release is installed, use a unique run ID. The seed is pinned to tenant A and creates only one deterministic DRAFT tour (no registrations, payments, or outbox events). Apply requires the exact one-command confirmation below; the wrapper saves the exact cleanup manifest under the dedicated staging directory with mode 0600. Capture release SHA, run ID, tour ID, and the apply result in the evidence ledger.

```bash
RELEASE=/opt/app-tour-staging/releases/REPLACE_WITH_REVIEWED_SHA
RUN_ID=s2e04-a-draft-20261029-r1
"$RELEASE/bin/seed-denali-first-staging-draft-tour.sh" --run-id "$RUN_ID"
DENALI_FIRST_STAGING_DRAFT_TOUR_CONFIRM=seed-denali-first-s2e-draft-tour-to-tour_db_staging \
  "$RELEASE/bin/seed-denali-first-staging-draft-tour.sh" --run-id "$RUN_ID" --apply
MANIFEST=/etc/app-tour-staging/denali-first-staging-draft-tour-manifests/$RUN_ID.json
"$RELEASE/bin/cleanup-denali-first-staging-draft-tour.sh" --run-id "$RUN_ID" --manifest "$MANIFEST"
```

Do not apply cleanup until the E04 acceptance evidence is captured. If cleanup is approved, first preserve the cleanup dry-run output, then use its separate confirmation `cleanup-denali-first-s2e-draft-tour-from-tour_db_staging` and record the post-delete read-back. Cleanup refuses rows with registration, transport, roster-freeze, outbox, or Denali exposure reminder dependencies. The E04 staging case remains open until A→B and B→A tour detail/edit denial plus the owner-side unchanged/read-back proof pass on the deployed SHA.

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

The repository has a targeted six-check Playwright network/TLS runner. Before invoking it, the operator must verify the checkout is clean and supply the exact checked-out test SHA; the runner itself does **not** inspect Git status or compare that SHA to Git HEAD. Provide an approved manifest that declares the exact six origins, ingress IP allowlist, tenant IDs, and runtime SHA, plus a unique `runId`. The runtime SHA remains an approved-manifest value and is not independently attested by the served application. Run from the repository root:

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

- Deploy workflow 40931409066 completed successfully including transfer/install/migration/standard seed, four-process health, app-role RLS and workspace adapter. The official six-case runner and fresh host-to-tenant probes pass through a process-isolated resolver/tunnel; system DNS remains unavailable. Browser trust isolation passed using a temporary dedicated NSS profile.
- A Owner and Finance login now pass on current SHA `55a7085` with separate temporary cookie contexts and strict CA validation. Finance-specific business access, refresh/returnTo, and the complete business acceptance matrix remain open. Synthetic A Member login and A→B portal replay denial are verified on the earlier SHA `52aad2e`; revalidate those cases on the current release. Do not use the non-test A Owner. The B Finance team login is accepted, while the generic owner-panel session route correctly denies non-owner roles.

## A Owner/Finance task identities

The guarded seed path for synthetic A Owner and Finance identities is included in current staging release SHA `55a7085ddf52a5c7b90e29da46c2226649daf73e`. It uses fixed reserved user IDs, resolves mobiles only from `DENALI_FIRST_STAGING_OWNER_MOBILE` and `DENALI_FIRST_STAGING_FINANCE_MOBILE`, rejects cross-tenant memberships and identity/mobile collisions, and requires `DENALI_FIRST_STAGING_IDENTITIES_CONFIRM=seed-denali-a-identities-to-tour_db_staging` for apply. The seed also refuses to add accounts whose mobile has pre-existing OTP challenges. Read-only preflight confirmed the exact A identities are ACTIVE with exactly one A membership each and no other-tenant membership; strict-CA A Owner and Finance login/ability-context read-backs pass on this release. No account seed or cleanup was performed during the latest login checks.

The latest `DENALI_SECOND_STAGING_FIXTURES_CONFIRM` apply retry for B run `qa2-20261029-acceptance-01` failed closed because the required `DENALI_SECOND_STAGING_*_MOBILE` inputs are absent from the staging API environment. No database writes occurred. Do not supply unrelated user numbers; obtain the approved synthetic fixture inputs before retrying. Current cleanup preview is available and read-only.

The identity seed preview can be run from the release symlink:

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

Earlier deploy SHA `52aad2eed33ea35925ebba9abcda79c1ae2a095e` and runner `local-stg-20261029-0f08b79e1` are historical. The latest official staging release is SHA `55a7085ddf52a5c7b90e29da46c2226649daf73e`, workflow `40931409066`, artifact digest `sha256:5597bda7cb7dd3f4f99ec5eb48a58c6c1a53f96eb92604095d0fe9373ac43f6a`. The current release's six-check strict-TLS API/browser runner passed with a dedicated temporary NSS profile (`local-stg-20261029-64936efab2`); current API host probes returned expected A/B tenant IDs. System DNS remains unresolved. Strict-CA A Owner and Finance login/ability-context checks now pass on the current release; B Owner/Finance/Admin/Member checks and A Member/replay checks are on the earlier SHA and need current-release revalidation where the matrix requires it. S2-E05 list/search/filter/pagination/count isolation passes on current SHA. S2-E06 includes only the Owner invoice boundary, while registration/receipt cases remain open. The complete 18-case acceptance command, artifact-aware rollback, and TLS renewal/recovery drill remain unverified.

## Latest continuation — current-release fixture guards (2026-10-29)

- The B task fixture preview for `qa2-20261029-acceptance-01` passed against release `55a7085ddf52a5c7b90e29da46c2226649daf73e` (5 resources, 2 tours, 2 registrations, no outbox).
- A guarded `--apply` retry stopped before any DB write because the required synthetic B identity-mobile inputs were not configured. The apply path requires the exact `DENALI_SECOND_TENANT_STAGING_FIXTURES_CONFIRM=seed-denali-qa2-fixtures-to-tour_db_staging` confirmation as well; no guard was bypassed.
- Cleanup preview against the saved exact-run manifest passed and found the expected 2 registrations, 2 tours, and 5 resources while preserving tenant, identities, wizard template, and other-tenant data. No apply or rollback was run.

- This execution session can reach the staging host using the configured `app-tour-vps` SSH alias. A fresh read-only check confirmed `/opt/app-tour-staging/current` resolves to release `55a7085ddf52a5c7b90e29da46c2226649daf73e` and the API, web, marketing, and portal units are active. This establishes an available runner path for SSH diagnostics; it does not make workstation DNS resolve private `.staging.test` hostnames or replace strict-TLS runtime checks.

## Latest continuation — S2-E04 fixture review corrections (2026-10-29)

- Fresh independent review found two safety gaps before any artifact was built: cleanup did not count `DenaliExposureReminderActivation` rows, and seed used repository `save` after a separate existence check, which could overwrite a conflicting row under a race.
- Cleanup now includes tenant-scoped reminder activation counts in its zero-dependency guard. Seed now checks and creates in one Serializable tenant-RLS transaction using `create` only; a unique-key or serialization conflict aborts without updating a row.
- Reconciliation now checks canonical JSON plus scalar title, publish status, schema version, row version, and creation timestamp. Shell wrappers reject malformed run IDs before path construction, and cleanup pins the resolved manifest directory to the configured path.
- Focused API suite: **21/21 PASS**; artifact contract suite: **15/15 PASS**; API `tsc --noEmit`, wrapper `bash -n`, `git diff --check`, and `guard:doc-sync`: **PASS**. Both CJS seed/cleanup bundles built and passed `node --check`; esbuild reported duplicate-key warnings in existing root and workspace manifests.
- These are local code/package checks only. No artifact containing the changes has been deployed, no S2-E04 row has been seeded, and live cross-tenant GET/PATCH, concurrent database behavior, dependency query behavior, cleanup apply, and rollback remain unverified.
