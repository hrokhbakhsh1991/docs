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
      defaultEventPolicies: [{ eventType: "TourPublished", enabled: true }],
      eventMappings: [{ eventType: "TourPublished", capability: "message.send" }],
    },
  ],
  messageTemplates: {
    TourPublished: "Tour published: {{title}}",
  },
}) satisfies WorkspaceIntegrationSurface;

validateIntegrationSurface(denaliIntegrationSurface);

export function getDenaliIntegrationSurface(): WorkspaceIntegrationSurface {
  return denaliIntegrationSurface;
}
