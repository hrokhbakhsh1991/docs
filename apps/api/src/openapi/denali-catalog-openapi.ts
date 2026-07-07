/**
 * OpenAPI operation overrides for Denali public catalog registration.
 * @see docs/workspaces/denali/public-catalog.md
 */
export const DENALI_CATALOG_OPENAPI_OVERRIDES: Record<string, Record<string, unknown>> = {
  postDenaliRegistration: {
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["tourId", "contact", "partySize"],
            properties: {
              tourId: { type: "string", format: "uuid" },
              registrantTarget: { type: "string", enum: ["self", "other"] },
              contact: {
                type: "object",
                required: ["fullName"],
                properties: {
                  fullName: { type: "string", minLength: 1, maxLength: 200 },
                  email: { type: "string", format: "email" },
                  phone: { type: "string", maxLength: 32 },
                  nationalId: { type: "string", pattern: "^\\d{10}$" },
                  fatherName: { type: "string", minLength: 1, maxLength: 200 },
                  birthDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                },
              },
              partySize: { type: "integer", minimum: 1 },
              transport: {
                type: "object",
                required: ["kind"],
                properties: {
                  kind: {
                    type: "string",
                    enum: ["primary", "personal_car", "no_car_dong", "no_car_acquaintance"],
                  },
                  personalCarOccupants: { type: "integer", enum: [1, 2, 3] },
                },
              },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: "Pending booking created",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" },
                data: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    status: { type: "string", enum: ["pending"] },
                  },
                },
              },
            },
          },
        },
      },
      409: { description: "DENALI_REGISTRATION_DUPLICATE" },
    },
  },
};
