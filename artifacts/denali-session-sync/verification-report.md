# Marketing / Portal session synchronization — final local verification

Base: `913856bc15e80c9e60e9fd82550851ce1ae781d5` (`origin/dev`). Branch: `codex/denali-session-sync`. Original dirty-workspace edits were preserved. No deployment or merge was performed.

## Confirmed defects

1. **Stale server snapshot.** Staging open tabs retained authenticated header/PDP `member-self` about ten seconds after Portal logout; the reverse mismatch occurred after PDP login. Portal protected routes still redirected to login. Marketing derived its auth UI only from server-rendered data, without subsequent session observation. The staging runtime SHA was not established.
2. **Cookie resurrection.** Portal middleware reissued a valid member cookie on passive requests. Holding a pre-logout session response, completing logout and releasing that response restored the cleared cookie. Real signed-JWT middleware tests and the browser race reproduced this independently. Passive credential reissuance was removed; successful authentication and logout retain their existing cookie-domain helpers.
3. **Pending-probe timing.** A later run reopened acceptance when a home tab stayed authenticated beyond five seconds. A deterministic browser regression then isolated a concrete scheduling defect: the four-second pending request blocked activation and the next three-second polling tick, pushing the next successful observation beyond five seconds. The held-probe test was RED before the final timing fix. Ordinary probe traces passing five repetitions were not treated as proof that this deadline defect was absent.

## Final implementation

The existing tenant-bound, credentialed Portal endpoint supplies only a boolean. One Marketing context updates header and tour CTA together before server revalidation. Visible tabs poll every **2.5 seconds**, with a **two-second request deadline**, and recheck on focus, pageshow and visibility activation. Activation aborts a pending older check. Controller identity prevents obsolete completions or cleanup from replacing a newer observation. Hidden tabs do not initiate polling.

Non-2xx, malformed and failed probes preserve the last confirmed UI; endpoint exceptions return 503 rather than a successful signed-out response. Identical observations do not repeatedly refresh an SSR disagreement. No tokens or personal data are synchronized, persisted or broadcast. Portal remains the authority and protects private routes.

The existing pure tour CTA model is reused. Member/self-registration and closed-tour behavior are preserved. An authenticated waitlist action follows Portal intake instead of reopening login; its rendered-component regression was RED before the guest-only modal guard.

Historical host-only sessions require fresh authentication for shared-domain server personalization. The boolean adapter can show the generic account link while server personalization refreshes. No schema, dependency or visual-design change was made.

## RED / GREEN evidence

- Signed-JWT passive-read RED: `probe-cookie-red.log`, `passive-cookie-red.log`.
- Cookie-resurrection browser RED: `probe-cookie-browser-red2.log` (cookie absent after logout, restored after old response). Cookie values are not reproduced here.
- Same cookie race GREEN: `probe-cookie-browser-green.log`, three repetitions; repeated successfully in the final runtime matrix. Portal source/build was unchanged by the later client timing fix.
- Previous server-refresh-only recovery RED: `e2e-recovery-react-state.log`. Shared committed context resolved the measured recovery path; no framework-internal root cause is claimed.
- Pending-probe deadline RED: `e2e-pending-probe-red.log` (two rendered account links remained after five seconds).
- Final timing implementation GREEN: `e2e-pending-probe-green.log`, three repetitions, plus independent visible-polling and native-tab-activation cases in the final matrix.
- Member waitlist RED/GREEN: `session-ui-behavior-red.log`, `session-ui-green.log`.

## Final-source checks

Application build IDs: Marketing `JM2Cd4Eo-Lg0wy1H0k3JQ`; Portal `5Si_tJt8WeemXXEN1UYy9`. The Portal source/build is unchanged by the timing follow-up. Production-built apps ran against deterministic memory API fixtures over HTTP Profile B.

- Browser matrix: **10 passed, 0 failed, 0 skipped**, in two fresh fixture runtimes: `e2e-timing-auth.log` (4) and `e2e-timing-state.log` (6).
- Coverage: header and PDP login; same-context logout/re-login without reloading the old PDP; rendered header links and CTA; desktop/mobile; reload/Back; protected-route denial; browser cookie expiry; Denali JWT rejected by Urban; unrelated-origin CORS rejection; 503/invalid/disconnected probe recovery; unsaved search retained; no refresh loop; late pre-logout response; native hidden-tab pause/recovery; old pending probe during visible polling and real tab activation.
- Main journey on final app source: **three passes** — one in the localhost auth group and two on custom apex `denali.club` (`e2e-timing-custom-main.log`), all including same-context re-login.
- Marketing full unit suite: **373 passed** (`marketing-all-unit-timing-final.log`); Portal: **409 passed** (`portal-all-unit.log`, unchanged Portal source). Focused final Marketing tests: 28 passed.
- Both production builds, app lint/typecheck and focused Playwright TypeScript checks passed. Architecture/import boundaries, Portal profile/architecture-truth, PCMS authority and doc-sync checks passed. Formatting and final diff checks passed.
- Authenticated and logged-out desktop PDP screenshots were inspected: account changed to login; continue changed to guest registration/sign-in. Final images are retained locally in the test output/evidence directory. Mobile interaction assertions passed; no visual redesign comparison is claimed.

CI runs the same two groups with fresh managed API/Portal processes. This respects the real five-OTP/minute BFF quota: at most five OTP requests per group. A rapid earlier third re-login repetition hit that quota and is recorded as a fixture-rate failure, not a successful auth-sync test. No security limiter was disabled. Output folders are separate so screenshots survive both groups.

Native visibility tests launch an isolated browser and connect with `noDefaults: true`; ordinary Playwright focus overrides report background pages as visible. Native tests assert actual hidden/visible state and delete their browser profile on cleanup. No `--disable-web-security` or TLS-ignore setting is used. Fault injection affects only session probes through a loopback proxy; the fake-ready loop case is not evidence of authentication.

## Limits and rollout

Corrected staging behavior remains **unverified**: this revision is not deployed and current staging runtime SHA is unknown. Local HTTP tests do not certify production HTTPS attributes, real SMS delivery, every deployment origin-map configuration, or server token revocation. Actual browser cookie expiry is covered separately. The older embedded Chromium Domain unit check reported its bundled browser unavailable; the new browser tests independently exercised real cookie sharing.

The production fixture has one explicit canonical Marketing origin. An earlier added expectation that it would reject that configured origin on another localhost tenant was incompatible with that setup. Final tests separately prove rejection of an unrelated tenant origin and of a signed foreign-tenant cookie; no broader CORS-policy change was made.

PR CI results must be checked against the final pushed head; historical CI greens do not establish a later revision. The local A–J ledger keeps corrected staging BLOCKED pending authorized deployment and runtime-version verification.

Rollback: revert this PR. There is no schema/data migration; reverting restores the confirmed stale-UI, late-cookie and probe-deadline defects.

## CI follow-up on 37957888e

The final-head Marketing CI recovery assertion failed despite the local production matrix above. Acceptance was reopened and the PR remained draft; earlier local greens did not override that failure. The old test lacked evidence that its browser session observer had initialized or that logout had completed successfully.

The test now establishes a real authenticated browser probe before injecting faults, awaits HTTP 200 logout and an absent cookie, then independently checks Portal status after recovery. Its five-second recovery budget is still measured from restoration; it was not increased. Failure artifacts contain only HTTP status, boolean session/cookie/DOM state and timestamps. Temporary React-internal diagnostics were removed.

The authenticated, initialized development-runtime recovery scenario passed five repetitions (`e2e-ready-dev-diagnostic.log`), and the final sanitized test passed once in that runtime (`e2e-ready-dev-final-test.log`). Cold developer-server startup failures are separate initialization failures, not passes or evidence of the CI UI defect. No speculative application-state refactor was introduced.

Session synchronization now has a dedicated CI job, isolated from the older session-bridge suites and their runtimes. Both fresh fixture groups still execute; the second runs after a first-group failure to retain independent evidence. Remote acceptance remains pending the next pushed-head results. The previous CI failure's exact internal rendering cause is not claimed from incomplete evidence.

The final sanitized recovery test also passed three repetitions against the preserved production build (`e2e-ready-production-final.log`). Application code is byte-identical to `37957888e`; this follow-up changes test preconditions, safe failure evidence and CI isolation, not the five-second application criterion.

## CI transport evidence on ad17e085f

The dedicated CI job failed its recovery case; the remaining six state/race cases passed. Its sanitized observation records an absent member cookie but `source.status = null` after a 2,017 ms browser timeout. There was no confirmed signed-out response at that assertion. Preserving the last known account state on that transport error is intentional; this evidence does not establish a React-rendering failure. The PR remains draft.

Recovery measurement now separates transport availability from UI latency. After restoration, it accepts the first readable fresh app probe or an independent credentialed browser probe (transport readiness has a separate 30-second limit). The first successful HTTP response must immediately satisfy the exact signed-out contract; a wrong boolean or invalid body is not retried until it becomes correct. An independently recorded DOM transition must occur within five seconds of the earliest successful observation. Search retention and refresh-loop assertions remain in place. This does not extend the normal logout/activation five-second tests, and no application source changed.

A scoped `typecheck:session-sync` command and project config now check the regression suite and its imported native-browser helper in the Marketing package; CI runs it before browser installation. This avoids silently leaving E2E TypeScript outside the application's normal typecheck scope.

The revised recovery measurement passed **three production-browser repetitions** (`e2e-transport-production.log`, 3 passed / 0 failed / 0 skipped). Scoped regression TypeScript, formatting and diff checks passed. Application source and production builds remain identical to the previous full matrix; remote acceptance is still pending the new pushed test revision.
