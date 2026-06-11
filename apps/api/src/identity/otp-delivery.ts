export function deliverOtpCode(mobile: string, code: string): void {
  if (process.env.RESEND_API_KEY?.trim()) {
    return;
  }
  if (process.env.NODE_ENV === "production") {
    return;
  }
  // Dev/staging without SMS provider — visible in API logs only (never returned in HTTP body).
  // eslint-disable-next-line no-console -- intentional dev OTP delivery
  console.info(`[otp-dev] mobile=${mobile.trim()} code=${code}`);
}
