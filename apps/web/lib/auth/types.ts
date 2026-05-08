/** Mirrors POST /api/v2/auth/web/session/otp contract */
export type PhoneOtpSessionRequestBody = {
  phone: string;
  otp: string;
};

export type WebSessionResponseBody = {
  session_token: string;
  user_id: string;
  tenant_id: string;
  entry_mode: "web";
};
