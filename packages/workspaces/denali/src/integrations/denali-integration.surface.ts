import {
  validateIntegrationSurface,
  type WorkspaceIntegrationSurface,
} from "@app-tour/workspace-sdk";

export const denaliIntegrationSurface = Object.freeze({
  manifestVersion: 1 as const,
  providers: [
    {
      id: "telegram",
      configFields: [{ id: "channelId", kind: "string" as const, requiredOnCreate: true }],
      credentialFields: [{ id: "botToken", kind: "secret" as const, requiredOnCreate: true }],
      defaultCapabilities: ["message.send"] as const,
      defaultEventPolicies: [{ eventType: "TourCreated", enabled: true }],
      eventMappings: [{ eventType: "TourCreated", capability: "message.send" }],
    },
  ],
  messageTemplates: {
    TourCreated: "Tour created: {{title}}",
  },
}) satisfies WorkspaceIntegrationSurface;

validateIntegrationSurface(denaliIntegrationSurface);

export function getDenaliIntegrationSurface(): WorkspaceIntegrationSurface {
  return denaliIntegrationSurface;
}
