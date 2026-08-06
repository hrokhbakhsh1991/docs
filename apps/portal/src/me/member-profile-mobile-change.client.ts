type MemberMobileChangeErrorBody = {
  readonly ok?: boolean;
  readonly challenge_id?: string;
  readonly mobile?: string;
  readonly code?: string;
  readonly error?: { readonly code?: string };
};

function readMemberMobileChangeErrorCode(
  payload: MemberMobileChangeErrorBody,
  fallback: string
): string {
  if (typeof payload.error?.code === "string" && payload.error.code.length > 0) {
    return payload.error.code;
  }
  if (typeof payload.code === "string" && payload.code.length > 0) {
    return payload.code;
  }
  return fallback;
}

export async function requestMemberMobileChangeOtp(
  phone: string
): Promise<{ readonly challengeId: string }> {
  const response = await fetch("/api/me/mobile/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  const payload = (await response.json().catch(() => ({}))) as MemberMobileChangeErrorBody;
  if (!response.ok || payload.ok !== true || typeof payload.challenge_id !== "string") {
    throw new Error(
      readMemberMobileChangeErrorCode(payload, `MOBILE_CHANGE_OTP_HTTP_${response.status}`)
    );
  }
  return { challengeId: payload.challenge_id };
}

export async function verifyMemberMobileChange(
  phone: string,
  challengeId: string,
  otp: string
): Promise<{ readonly mobile: string }> {
  const response = await fetch("/api/me/mobile/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, challenge_id: challengeId, otp }),
  });
  const payload = (await response.json().catch(() => ({}))) as MemberMobileChangeErrorBody;
  if (!response.ok || payload.ok !== true || typeof payload.mobile !== "string") {
    throw new Error(
      readMemberMobileChangeErrorCode(payload, `MOBILE_CHANGE_VERIFY_HTTP_${response.status}`)
    );
  }
  return { mobile: payload.mobile };
}
