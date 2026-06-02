import assert from "node:assert/strict";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";

import { tenantTestHost } from "../tenant-test-host";

/** Non-production test OTP; matches `AuthService.validatePhoneOtp` outside `production`. */
export const E2E_DEV_OTP = "1234";

export type LoginOtpParams = {
  phone: string;
  tenantSubdomain: string;
  otp?: string;
  challengeId?: string;
  inviteToken?: string;
};

export type LoginOtpSessionResult = {
  kind: "session";
  token: string;
  userId: string;
  tenantId: string;
};

export type LoginOtpRegistrationResult = {
  kind: "registration";
  onboardingToken: string;
  phone: string;
  tenantId: string;
};

export type LoginOtpOrRegistrationResult = LoginOtpSessionResult | LoginOtpRegistrationResult;

export type CompleteRegistrationParams = {
  onboardingToken: string;
  fullName: string;
  email?: string;
  /** Optional Host subdomain for middleware (onboarding JWT carries tenant_id). */
  tenantSubdomain?: string;
};

export type PostCompleteRegistrationRawParams = {
  onboardingToken: string;
  fullName: string;
  email?: string;
  tenantSubdomain?: string;
  host?: string;
};

export type CompleteRegistrationResult = {
  token: string;
  userId: string;
  tenantId: string;
};

export type SwitchWorkspaceParams = {
  bearer: string;
  targetTenantId: string;
  /** Host subdomain for the target workspace (required when host strict). */
  tenantSubdomain: string;
};

export type PostWorkspaceSessionRawParams = {
  bearer: string;
  targetTenantId: string;
  /** When set, sends `Host: {subdomain}.localhost`. */
  hostSubdomain?: string;
};

export type GetToursRawParams = {
  bearer: string;
  tenantSubdomain: string;
};

export type PostWebSessionOtpRawParams = {
  /** Sends `Host: {subdomain}.localhost` when set (unless `host` overrides). */
  tenantSubdomain?: string;
  /** Raw `Host` header (e.g. `localhost` for apex invalid). */
  host?: string;
  body?: Record<string, unknown>;
};

export type HttpRawResponse = {
  status: number;
  body: Record<string, unknown>;
};

export type SwitchWorkspaceResult = {
  token: string;
  userId: string;
  tenantId: string;
};

export function decodeSessionTenantId(token: string): string {
  const claims = decodeJwtPayload(token);
  const tenantId = claims.tenant_id;
  assert.equal(typeof tenantId, "string");
  return (tenantId as string).trim().toLowerCase();
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  assert.equal(parts.length, 3);
  const json = Buffer.from(parts[1], "base64url").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

export async function loginOtp(
  app: INestApplication,
  params: LoginOtpParams,
): Promise<string> {
  const result = await loginOtpOrRegistration(app, params);
  assert.equal(
    result.kind,
    "session",
    `loginOtp expected session, got ${result.kind}: ${JSON.stringify(result)}`,
  );
  return result.token;
}

export async function loginOtpOrRegistration(
  app: INestApplication,
  params: LoginOtpParams,
): Promise<LoginOtpOrRegistrationResult> {
  const otp = params.otp ?? E2E_DEV_OTP;
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/web/session/otp")
    .set("Host", tenantTestHost(params.tenantSubdomain))
    .send({
      phone: params.phone,
      otp,
      ...(params.challengeId ? { challenge_id: params.challengeId } : {}),
      ...(params.inviteToken ? { invite_token: params.inviteToken } : {}),
    });

  assert.equal(
    response.status,
    200,
    `POST /api/v2/auth/web/session/otp expected 200, got ${response.status}: ${JSON.stringify(response.body)}`,
  );

  if (response.body.requires_registration === true) {
    assert.equal(typeof response.body.onboarding_token, "string");
    assert.ok((response.body.onboarding_token as string).length > 10);
    const tenantId =
      typeof response.body.tenant_id === "string"
        ? (response.body.tenant_id as string)
        : decodeSessionTenantIdFromBody(response.body);
    return {
      kind: "registration",
      onboardingToken: response.body.onboarding_token as string,
      phone: params.phone,
      tenantId,
    };
  }

  assert.equal(typeof response.body.session_token, "string");
  const token = response.body.session_token as string;
  assert.ok(token.length > 20);
  assert.equal(typeof response.body.user_id, "string");
  assert.equal(typeof response.body.tenant_id, "string");

  return {
    kind: "session",
    token,
    userId: response.body.user_id as string,
    tenantId: (response.body.tenant_id as string).trim().toLowerCase(),
  };
}

function decodeSessionTenantIdFromBody(body: Record<string, unknown>): string {
  if (typeof body.tenant_id === "string") {
    return body.tenant_id.trim().toLowerCase();
  }
  return "";
}

export async function postCompleteRegistrationRaw(
  app: INestApplication,
  params: PostCompleteRegistrationRawParams,
): Promise<HttpRawResponse> {
  const req = request(app.getHttpServer()).post("/api/v2/auth/web/registration/complete");
  if (params.host) {
    req.set("Host", params.host);
  } else if (params.tenantSubdomain) {
    req.set("Host", tenantTestHost(params.tenantSubdomain));
  }
  const response = await req.send({
    onboarding_token: params.onboardingToken,
    full_name: params.fullName,
    ...(params.email ? { email: params.email } : {}),
  });
  return {
    status: response.status,
    body: response.body as Record<string, unknown>,
  };
}

export async function completeRegistration(
  app: INestApplication,
  params: CompleteRegistrationParams,
): Promise<CompleteRegistrationResult> {
  const req = request(app.getHttpServer()).post("/api/v2/auth/web/registration/complete");
  if (params.tenantSubdomain) {
    req.set("Host", tenantTestHost(params.tenantSubdomain));
  }
  const response = await req.send({
    onboarding_token: params.onboardingToken,
    full_name: params.fullName,
    ...(params.email ? { email: params.email } : {}),
  });

  assert.equal(
    response.status,
    200,
    `POST /web/registration/complete expected 200, got ${response.status}: ${JSON.stringify(response.body)}`,
  );
  assert.equal(typeof response.body.session_token, "string");
  const token = response.body.session_token as string;
  return {
    token,
    userId: response.body.user_id as string,
    tenantId: (response.body.tenant_id as string).trim().toLowerCase(),
  };
}

export async function postWebSessionOtpRaw(
  app: INestApplication,
  params: PostWebSessionOtpRawParams = {},
): Promise<HttpRawResponse> {
  const req = request(app.getHttpServer()).post("/api/v2/auth/web/session/otp");
  if (params.host) {
    req.set("Host", params.host);
  } else if (params.tenantSubdomain) {
    req.set("Host", tenantTestHost(params.tenantSubdomain));
  }
  const response = await req.send(params.body ?? {});
  return {
    status: response.status,
    body: response.body as Record<string, unknown>,
  };
}

export async function postWorkspaceSessionRaw(
  app: INestApplication,
  params: PostWorkspaceSessionRawParams,
): Promise<HttpRawResponse> {
  const req = request(app.getHttpServer())
    .post("/api/v2/auth/workspace/session")
    .set("Authorization", `Bearer ${params.bearer}`)
    .send({ tenant_id: params.targetTenantId });
  if (params.hostSubdomain) {
    req.set("Host", tenantTestHost(params.hostSubdomain));
  }
  const response = await req;
  return {
    status: response.status,
    body: response.body as Record<string, unknown>,
  };
}

export async function getToursRaw(
  app: INestApplication,
  params: GetToursRawParams,
): Promise<HttpRawResponse> {
  const response = await request(app.getHttpServer())
    .get("/api/v2/tours")
    .set("Host", tenantTestHost(params.tenantSubdomain))
    .set("Authorization", `Bearer ${params.bearer}`);
  return {
    status: response.status,
    body: response.body as Record<string, unknown>,
  };
}

export async function switchWorkspace(
  app: INestApplication,
  params: SwitchWorkspaceParams,
): Promise<SwitchWorkspaceResult> {
  const response = await request(app.getHttpServer())
    .post("/api/v2/auth/workspace/session")
    .set("Host", tenantTestHost(params.tenantSubdomain))
    .set("Authorization", `Bearer ${params.bearer}`)
    .send({ tenant_id: params.targetTenantId });

  assert.equal(
    response.status,
    200,
    `POST /workspace/session expected 200, got ${response.status}: ${JSON.stringify(response.body)}`,
  );
  assert.equal(typeof response.body.session_token, "string");
  const token = response.body.session_token as string;
  return {
    token,
    userId: response.body.user_id as string,
    tenantId: (response.body.tenant_id as string).trim().toLowerCase(),
  };
}

export type AuthSessionFactory = {
  loginOtp: (params: LoginOtpParams) => Promise<string>;
  loginOtpOrRegistration: (params: LoginOtpParams) => Promise<LoginOtpOrRegistrationResult>;
  completeRegistration: (params: CompleteRegistrationParams) => Promise<CompleteRegistrationResult>;
  switchWorkspace: (params: SwitchWorkspaceParams) => Promise<SwitchWorkspaceResult>;
  postWebSessionOtpRaw: (params?: PostWebSessionOtpRawParams) => Promise<HttpRawResponse>;
  postCompleteRegistrationRaw: (
    params: PostCompleteRegistrationRawParams,
  ) => Promise<HttpRawResponse>;
  postWorkspaceSessionRaw: (params: PostWorkspaceSessionRawParams) => Promise<HttpRawResponse>;
  getToursRaw: (params: GetToursRawParams) => Promise<HttpRawResponse>;
  decodeSessionTenantId: (token: string) => string;
  decodeJwtPayload: (token: string) => Record<string, unknown>;
};

export function createAuthSessionFactory(app: INestApplication): AuthSessionFactory {
  return {
    loginOtp: (params) => loginOtp(app, params),
    loginOtpOrRegistration: (params) => loginOtpOrRegistration(app, params),
    completeRegistration: (params) => completeRegistration(app, params),
    switchWorkspace: (params) => switchWorkspace(app, params),
    postWebSessionOtpRaw: (params) => postWebSessionOtpRaw(app, params),
    postCompleteRegistrationRaw: (params) => postCompleteRegistrationRaw(app, params),
    postWorkspaceSessionRaw: (params) => postWorkspaceSessionRaw(app, params),
    getToursRaw: (params) => getToursRaw(app, params),
    decodeSessionTenantId,
    decodeJwtPayload,
  };
}
