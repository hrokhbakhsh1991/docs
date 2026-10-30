# S2-E10 staging wizard tour cleanup

The S2-E10 Playwright test writes `s2-e10-wizard-tour-manifest.json` before the
tour creation request and refreshes it with the returned tour ID afterwards.
The artifact stays in that Playwright run's output directory. Copy it to the
staging host before cleanup; the staging wrapper accepts manifests only from
the root-owned QA2 manifest directory.

From the test runner, set `MANIFEST` to the emitted file:

```bash
scp -p "$MANIFEST" app-tour-vps:/tmp/s2-e10-wizard-manifest.json
ssh app-tour-vps 'sudo -n install -o root -g root -m 0600 /tmp/s2-e10-wizard-manifest.json /etc/app-tour-staging/denali-second-staging-manifests/s2-e10-wizard-manifest.json && sudo -n rm -f /tmp/s2-e10-wizard-manifest.json'
```

Preview first. The command checks only the fixed B tenant and exact run title,
requires the creation timestamp to fall within the run window, and refuses to
delete a tour with registrations, allocations, roster freezes, or reminder
activations. Outbox history is retained.

```bash
ssh app-tour-vps 'sudo -n /opt/app-tour-staging/current/bin/cleanup-denali-second-staging-fixtures.sh --wizard-manifest /etc/app-tour-staging/denali-second-staging-manifests/s2-e10-wizard-manifest.json'
```

Apply only after the dry-run names the expected single test tour and reports
zero dependencies:

```bash
ssh app-tour-vps 'sudo -n env DENALI_SECOND_TENANT_STAGING_CLEANUP_CONFIRM=cleanup-denali-qa2-fixtures-from-tour_db_staging /opt/app-tour-staging/current/bin/cleanup-denali-second-staging-fixtures.sh --wizard-manifest /etc/app-tour-staging/denali-second-staging-manifests/s2-e10-wizard-manifest.json --apply'
```
