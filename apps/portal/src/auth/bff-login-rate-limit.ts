/**
 * BFF login rate limit — defense-in-depth before API OTP throttle.
 * @see docs/phase-9/appendices/identity-web-bff-addendum.md
 */
export {
  assertBffLoginRateLimit,
  checkBffLoginRateLimit,
  readBffLoginRateLimitKey,
  resetBffLoginRateLimitForTests,
} from "@app-tour/session-client";
