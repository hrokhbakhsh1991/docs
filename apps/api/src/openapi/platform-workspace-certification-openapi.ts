/**
 * Phase H — OpenAPI overrides for platform workspace catalog + tenant create certification gate.
 * @see docs/dev/workspace-certification.mdoc
 */
export const PLATFORM_WORKSPACE_CERTIFICATION_OPENAPI_OVERRIDES: Record<
  string,
  Record<string, unknown>
> = {
  listPlatformWorkspaces: {
    responses: {
      200: {
        description: "Workspace catalog with production certification tier (Phase H4)",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["workspaces"],
              properties: {
                workspaces: {
                  type: "array",
                  items: {
                    type: "object",
                    required: [
                      "id",
                      "types",
                      "displayName",
                      "productionTier",
                      "productionOnboardingAllowed",
                    ],
                    properties: {
                      id: { type: "string" },
                      types: { type: "array", items: { type: "string" } },
                      displayName: { type: "string" },
                      productionTier: { type: "string", enum: ["stub", "certified"] },
                      productionOnboardingAllowed: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  createPlatformTenant: {
    responses: {
      422: {
        description: "Workspace not certified for production onboarding (Phase H2)",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string", example: "workspace_not_certified_for_production" },
                code: { type: "string", example: "WORKSPACE_NOT_CERTIFIED_FOR_PRODUCTION" },
                workspaceType: { type: "string" },
                pluginId: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};
