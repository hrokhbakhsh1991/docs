/**
 * OpenAPI operation overrides for M17 public catalog auth routes.
 * @see docs/workspaces/denali/public-catalog.md
 */
export const PUBLIC_AUTH_OPENAPI_OVERRIDES: Record<
  string,
  Record<string, unknown>
> = {
  publicPhonePreflight: {
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["mobile"],
            properties: {
              mobile: { type: "string", description: "E.164 or normalized mobile" },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Whether mobile is already registered globally",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["exists"],
              properties: {
                exists: { type: "boolean" },
              },
            },
          },
        },
      },
    },
  },
  publicRequestOtp: {
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["mobile"],
            properties: {
              mobile: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "OTP challenge issued",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["challengeId"],
              properties: {
                challengeId: { type: "string", format: "uuid" },
              },
            },
          },
        },
      },
      429: { description: "OTP_RATE_LIMITED" },
    },
  },
  publicVerifyOtp: {
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["challengeId", "code"],
            properties: {
              challengeId: { type: "string", format: "uuid" },
              code: { type: "string", minLength: 4, maxLength: 8 },
              mobile: { type: "string" },
              otp: { type: "string", description: "Alias for code" },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Session issued or onboarding required",
        content: {
          "application/json": {
            schema: {
              oneOf: [
                {
                  type: "object",
                  required: ["sessionToken", "userId", "tenantId", "role"],
                  properties: {
                    sessionToken: { type: "string" },
                    userId: { type: "string", format: "uuid" },
                    tenantId: { type: "string", format: "uuid" },
                    role: { type: "string" },
                  },
                },
                {
                  type: "object",
                  required: ["requiresRegistration", "onboardingToken"],
                  properties: {
                    requiresRegistration: { type: "boolean", enum: [true] },
                    onboardingToken: { type: "string" },
                  },
                },
              ],
            },
          },
        },
      },
    },
  },
  publicRegisterComplete: {
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["onboardingToken", "displayName"],
            properties: {
              onboardingToken: { type: "string" },
              displayName: { type: "string", minLength: 1 },
              email: { type: "string", format: "email" },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Profile completed — session JWT",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["sessionToken", "userId", "tenantId", "role"],
              properties: {
                sessionToken: { type: "string" },
                userId: { type: "string", format: "uuid" },
                tenantId: { type: "string", format: "uuid" },
                role: { type: "string" },
              },
            },
          },
        },
      },
      400: { description: "DISPLAY_NAME_REQUIRED" },
      401: { description: "ONBOARDING_TOKEN_INVALID" },
    },
  },
};
