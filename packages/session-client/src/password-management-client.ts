export class PasswordManagementClientError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "PasswordManagementClientError";
  }
}

type PasswordBffPath = "/api/me/password" | "/api/identity/me/password";

export function createPasswordManagementClient(base: PasswordBffPath) {
  async function call(
    path: string,
    method: "GET" | "POST",
    body?: unknown
  ): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(path, {
        method,
        credentials: "same-origin",
        cache: "no-store",
        ...(body !== undefined
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
          : {}),
      });
    } catch {
      throw new PasswordManagementClientError("BACKEND_UNREACHABLE");
    }
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok || payload.ok !== true) {
      const error = payload.error;
      const code =
        typeof error === "object" &&
        error !== null &&
        typeof (error as Record<string, unknown>).code === "string"
          ? (error as { code: string }).code
          : "PASSWORD_REQUEST_FAILED";
      throw new PasswordManagementClientError(code);
    }
    return payload;
  }
  return {
    async hasPassword(): Promise<boolean> {
      const data = await call(base, "GET");
      if (typeof data.has_password !== "boolean")
        throw new PasswordManagementClientError("PASSWORD_REQUEST_FAILED");
      return data.has_password;
    },
    async requestOtp(): Promise<{ challengeId: string; otpLength: 4 | 6 }> {
      const data = await call(`${base}/request-otp`, "POST", {});
      if (
        typeof data.challenge_id !== "string" ||
        (data.otp_length !== 4 && data.otp_length !== 6)
      ) {
        throw new PasswordManagementClientError("OTP_REQUEST_FAILED");
      }
      return { challengeId: data.challenge_id, otpLength: data.otp_length };
    },
    async setPassword(input: {
      challengeId: string;
      otp: string;
      password: string;
    }): Promise<void> {
      await call(base, "POST", {
        challenge_id: input.challengeId,
        otp: input.otp,
        password: input.password,
      });
    },
  };
}
