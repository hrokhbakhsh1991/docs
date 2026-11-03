# Marketing / Portal session synchronization

Base: `913856bc15e80c9e60e9fd82550851ce1ae781d5` (`origin/dev`). Changes are isolated in `codex/denali-session-sync`; unrelated original-workspace edits were preserved.

## Reproduction and cause

Staging observations (2026-11-03, runtime SHA unknown): after Portal logout, two open Marketing pages retained authenticated headers and the PDP retained `member-self` about ten seconds later. Protected Portal profile correctly redirected to login. The reverse mismatch occurred after PDP login: an existing Marketing tab remained guest until reload. This establishes stale UI, not a protected-route bypass.

The Marketing layout and PDP derived auth only from the server-rendered snapshot; no subsequent Portal probe updated open tabs. The fix uses the existing credentialed, tenant-bound boolean Portal session endpoint. Header and CTA consume one committed client observation; server data revalidation follows the state commit. Identical polls do not keep refreshing a persistent SSR disagreement. Hidden tabs skip polling; visible tabs poll every three seconds and recheck on focus, pageshow and visibility activation. Unknown/malformed/failed probes preserve the last confirmed status. No token or personal data is synchronized or stored by this mechanism.

A separate real race was reproduced: middleware reissued a valid session cookie on passive requests. Holding a pre-logout session response, completing logout and then releasing the response restored the cookie. Signed-JWT middleware tests and the browser test both failed before the fix. Passive credential reissuance was removed; auth writes and logout clears retain the existing domain helpers. Historical host-only cookies require fresh authentication to obtain the shared-domain cookie.

Depending solely on a full server refresh for header/CTA remained unreliable in the injected-failure recovery test. Multiple refresh scheduling experiments were rejected. The final implementation commits the Portal observation to both consumers first and then refreshes server data; it has no custom refresh queue, broadcast channel or persisted synchronization state. The internal reason a previous full server render did not commit is not established; no framework bug is claimed.

An authenticated waitlist action also reopened login. A rendered-component regression failed on that behavior before adding the guest-only modal guard; members now follow the existing Portal intake link.

## Before / after evidence

- RED, real signed JWT: `probe-cookie-red.log`, `passive-cookie-red.log` — passive requests unexpectedly emitted a member cookie.
- RED, real browser: `probe-cookie-browser-red2.log` — expected no cookie after releasing the old response, received a restored cookie. No cookie value is included here.
- GREEN, same browser race: `probe-cookie-browser-green.log` — three successful repetitions; repeated in the final browser suite.
- RED, previous server-refresh-only implementation: `e2e-recovery-react-state.log` — one pass, two stale-header failures after fault recovery.
- GREEN, final shared-context implementation: `e2e-context-recovery.log` — three passes with 503, invalid response shape and broken connection; recovery within five seconds, input retained, no repeating page-refresh loop.
- GREEN, core three-tab journey: `e2e-context-main-repeat.log` — three passes covering header login, logout, header/CTA, tenant JWT rejection, unrelated-origin CORS rejection, reload, Back and protected-route denial.
- RED then GREEN for member waitlist: `session-ui-behavior-red.log`, `session-ui-green.log`.

## Verification

- `pnpm --filter @apps/marketing run test`: 373 passed (`marketing-all-unit-final.log`).
- `pnpm --filter @apps/portal run test`: 409 passed (`portal-all-unit.log`). The older embedded Chromium Domain check reported its browser unavailable; the new real-browser suite independently exercises actual cookie sharing and tenant separation.
- Both app lint/typechecks passed; new Playwright config/spec has an additional focused TypeScript check.
- Marketing and Portal production builds passed. Marketing build ID: `226sb6P0wLWAvkAwjY-Uo`; Portal build ID: `5Si_tJt8WeemXXEN1UYy9`.
- Architecture, import boundaries, Portal profile boundary, architecture-truth, PCMS authority and doc-sync checks passed. Source-contract guards follow the extracted components and retain navigation/DOM requirements.
- Final browser matrix: **8 passed, 0 failed, 0 skipped** (`e2e-acceptance.log`), including native hidden-tab behavior.
- Custom apex `http://denali.club` / `http://portal.denali.club:3104`: core journey **3 passed** (`e2e-custom-apex-final.log`), including independent rendered account/login link assertions plus CTA mode.
- Desktop authenticated and logged-out PDP screenshots inspected: header changed from account to login and CTA from continue to guest registration/sign-in. Images are retained locally under `screenshots/`. No appearance redesign was made.

## Limits and provenance

Local integration uses a memory API, deterministic existing synthetic member/tour and production-built Marketing/Portal over HTTP Profile B. Cookie/CORS security is enabled; no `--disable-web-security`, TLS-ignore setting or auth bypass is used. Faults affect only the session probe through a loopback test proxy. The fake-ready loop case is explicitly fault injection and proves UI/refresh behavior, not authentication. Actual clock-based browser cookie expiry is separate from server token revocation.

The initial headed run had six passes, one skip and one failed added CORS expectation. Its explicit single canonical Marketing origin also applied to the other localhost tenant, so the new expectation was incompatible with that fixture. The final test instead checks an unrelated tenant origin cannot read the Denali Portal, and separately presents the signed Denali cookie to Urban and requires ready=false plus protected-route rejection. It does not certify every deployment origin-map configuration.

Normal Playwright focus emulation reports background pages as visible. The real-hidden-tab case launches an isolated native browser and attaches using `noDefaults: true`, preserving native tab visibility; the browser profile is deleted on cleanup. This does not inject visibility events or disable browser web security.

No fixed version has been deployed to staging, and its current runtime SHA is unverified. Corrected staging behavior, production HTTPS cookie attributes, real SMS delivery, deployment CI and live multi-tenant origin-map configuration remain separate from these local results. No registration or profile was written on staging for this change.

Rollback requires only reverting this PR; there is no schema or data migration. Reverting restores the stale-UI and late-cookie defects.

Final local review: PASS for changed-file scope, sensitive-data pattern inspection, response contract, direct component consumers, cleanup, tenant cookie rejection and no-refresh-loop behavior. Remote CI is pending PR creation. Corrected staging runtime remains unverified.
