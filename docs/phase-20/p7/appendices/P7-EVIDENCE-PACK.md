# P7 — Evidence pack (T4 / exit 98+)

```yaml
evidence_id: P7-EVIDENCE-PACK
pack_version: "1.6"
authority: p7-customer-sign-off.md · p7-exit-checklist.md
verify: pnpm run p7:evidence-pack-verify
```

> **Purpose:** Single audit folder for customer sign-off and 98+ score — links proof to commits, URLs, and commands.

---

## Pack layout (create on staging proof)

```text
docs/phase-20/p7/evidence/<YYYY-MM-DD>-<club-id>/
  manifest.yaml          # copy from template below
  staging-gate.log       # pnpm run p7:staging-gate output
  staging-e2e.log        # p7-staging-e2e Profile B/C output
  finance-ops.log        # T3 output (optional)
  walkthrough-results.md # copy from wizard runbook §Results
  screenshots/           # VS-01..07 optional
  sign-off.pdf           # scanned T4 or exported markdown
```

**Do not commit secrets** — redact `DATABASE_URL` in logs.

---

## manifest.yaml template

```yaml
evidence_pack_version: "1.0"
club_id: alborz
tenant_id: 00000000-0000-4000-8000-000000000099
staging_profile: B   # A | B | C
git_sha: "<commit on staging deploy>"
deploy_date: "YYYY-MM-DD"
operator: "<name>"
architect: "<name>"

gates:
  p7_gate: PASS
  p7_staging_gate: PASS
  p7_staging_e2e: PASS
  finance_ops_t3: PASS | SKIP | N/A

vertical_slice:
  VS-01: PASS
  VS-02: PASS
  VS-03: PASS
  VS-04: PASS
  VS-05: PASS
  VS-06: PASS
  VS-07: PASS
  VS-08: PASS

urls:
  admin: "http://VPS_IP:3000/auth/login"
  marketing: "http://VPS_IP:3002/tours"
  portal: "http://VPS_IP:3003"
  api: "http://VPS_IP:3001/health"

waiver:
  profile_c_sms: false   # true if DEC-P7-013 waiver used
  reason: ""
```

---

## Capture commands

```bash
CLUB=alborz
DIR="docs/phase-20/p7/evidence/$(date +%Y-%m-%d)-${CLUB}"
mkdir -p "$DIR/screenshots"

export TOUR_OPS_API_URL=http://127.0.0.1:3001
export DATABASE_URL=postgresql://...

pnpm run p7:staging-gate 2>&1 | tee "$DIR/staging-gate.log"

# T2 — see p7-staging-e2e.md
# ... tee "$DIR/staging-e2e.log"

cp docs/phase-20/p7/runbooks/p7-wizard-blocker-walkthrough.md "$DIR/walkthrough-snapshot.md"
# Fill §Results in walkthrough before copy, or maintain walkthrough-results.md

pnpm run p7:evidence-pack-verify -- "$DIR/manifest.yaml"
```

---

## Verify script

```bash
pnpm run p7:evidence-pack-verify
# optional: pnpm run p7:evidence-pack-verify -- path/to/manifest.yaml
```

Checks: manifest schema · VS rows · gate PASS · no placeholder `<commit`.

---

## Sign-off linkage

Complete [p7-customer-sign-off.md](../runbooks/p7-customer-sign-off.md) · attach `manifest.yaml` path in T4 §Evidence field.

---

## References

- [IMPLEMENTATION-TRUTH-P7.md](IMPLEMENTATION-TRUTH-P7.md)
- [P7-EXIT-CRITERIA-98.md](P7-EXIT-CRITERIA-98.md)
