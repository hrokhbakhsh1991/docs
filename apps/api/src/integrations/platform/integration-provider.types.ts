import type { IntegrationCapability } from "./integration-capability";

/** Registry identifier for an external integration provider plugin. */
export type IntegrationProviderId = "telegram" | "slack" | "whatsapp" | "discord" | "email";

export type IntegrationDeliveryContext = {
  readonly tenantId: string;
  readonly workspaceType: string | null;
  readonly domainEventId: string;
  readonly eventType: string;
  readonly config: Record<string, unknown>;
  readonly credentials: Record<string, unknown>;
};

export type IntegrationSendMessageInput = {
  readonly channelId: string;
  readonly text: string;
  readonly parseMode?: "HTML" | "Markdown" | "MarkdownV2";
};

export type IntegrationCreateChannelLinkInput = {
  readonly title: string;
  readonly tourId: string;
};

export type IntegrationDeliveryResult = {
  readonly ok: boolean;
  readonly providerMessageId?: string;
  readonly inviteLink?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
};

/**
 * Provider plugin contract — adapters implement outbound API mapping only.
 * Business rules stay in workspace packages or integration application services.
 */
export type IntegrationProviderAdapter = {
  readonly id: IntegrationProviderId;
  readonly supportedCapabilities: readonly IntegrationCapability[];
  sendMessage(
    ctx: IntegrationDeliveryContext,
    input: IntegrationSendMessageInput
  ): Promise<IntegrationDeliveryResult>;
  createChannelLink?(
    ctx: IntegrationDeliveryContext,
    input: IntegrationCreateChannelLinkInput
  ): Promise<IntegrationDeliveryResult>;
};
