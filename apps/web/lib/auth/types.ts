/** Mirrors POST /api/v2/auth/web/session contract */

export type WebSessionRequestBody = {
  entry_mode: "web";
  credential: {
    email: string;
    password: string;
  };
  asserted_tenant_id: string;
};

export type WebSessionResponseBody = {
  session_token: string;
  user_id: string;
  tenant_id: string;
  entry_mode: "web";
};
