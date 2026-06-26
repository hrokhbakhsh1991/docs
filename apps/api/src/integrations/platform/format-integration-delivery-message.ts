import { resolveIntegrationSurfaceForWorkspaceType } from "./resolve-integration-surface";

export function formatIntegrationDeliveryMessage(input: {
  readonly workspaceType: string | null;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}): string {
  const surface = resolveIntegrationSurfaceForWorkspaceType(input.workspaceType);
  const template = surface?.messageTemplates?.[input.eventType] ?? "{{eventType}}: {{title}}";
  const title =
    typeof input.payload.title === "string" && input.payload.title.trim().length > 0
      ? input.payload.title.trim()
      : String(input.payload.aggregateId ?? input.payload.tourId ?? "");
  const aggregateId = String(input.payload.aggregateId ?? input.payload.tourId ?? "");

  return template
    .replaceAll("{{title}}", title)
    .replaceAll("{{aggregateId}}", aggregateId)
    .replaceAll("{{eventType}}", input.eventType);
}
