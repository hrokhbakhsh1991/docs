import type {
  IntegrationBackingSource,
  IntegrationConnectionPublicDto,
  WorkspaceIntegrationsListSummary,
} from "../platform/integration-connection.types";

const INTEGRATION_CONNECTION_ACTIONS = {
  enable: true,
  disable: true,
  test: true,
  patch: true,
  delete: true,
} as const;

const LEGACY_READONLY_ACTIONS = {
  enable: false,
  disable: false,
  test: true,
  patch: false,
  delete: false,
} as const;

export function integrationConnectionActionsAllowed() {
  return INTEGRATION_CONNECTION_ACTIONS;
}

export function legacyIntegrationActionsAllowed() {
  return LEGACY_READONLY_ACTIONS;
}

export function computeWorkspaceIntegrationsSummary(
  items: readonly IntegrationConnectionPublicDto[]
): WorkspaceIntegrationsListSummary {
  const integrationConnectionCount = items.filter(
    (item) => item.backingSource === "integration_connection"
  ).length;
  const legacyConnectionCount = items.filter(
    (item) => item.backingSource === "legacy_workspace_telegram_bot"
  ).length;

  const activeDeliverySource = resolveActiveDeliverySource(items);

  return {
    integrationConnectionCount,
    legacyConnectionCount,
    activeDeliverySource,
  };
}

export function resolveActiveDeliverySource(
  items: readonly IntegrationConnectionPublicDto[]
): IntegrationBackingSource | null {
  const hasEnabledIntegrationConnection = items.some(
    (item) =>
      item.backingSource === "integration_connection" && item.enabled && item.status === "enabled"
  );
  if (hasEnabledIntegrationConnection) {
    return "integration_connection";
  }

  const legacyCandidate = items.find(
    (item) =>
      item.backingSource === "legacy_workspace_telegram_bot" &&
      item.enabled &&
      !item.fallbackSuppressed
  );
  if (legacyCandidate !== undefined) {
    return "legacy_workspace_telegram_bot";
  }

  return null;
}

export function annotateActiveDeliverySource(
  items: readonly IntegrationConnectionPublicDto[]
): IntegrationConnectionPublicDto[] {
  const activeDeliverySource = resolveActiveDeliverySource(items);
  return items.map((item) => ({
    ...item,
    isActiveDeliverySource: item.backingSource === activeDeliverySource && item.enabled,
  }));
}

export function testConnectionMessageForCode(code: string | undefined): string {
  switch (code) {
    case "INTEGRATION_PROVIDER_NOT_REGISTERED":
      return "Provider adapter is not registered on this API instance.";
    case "INTEGRATION_CONFIG_INCOMPLETE":
      return "Channel ID is missing from integration config.";
    case "MELIPAYAMAK_ADAPTER_UNSUPPORTED":
      return "Melipayamak SMS adapter is not available on this API instance.";
    case "MELIPAYAMAK_TEST_RECIPIENT_REQUIRED":
      return "A test recipient is required before testing the Melipayamak connection.";
    case "MELIPAYAMAK_HTTP_ERROR":
    case "MELIPAYAMAK_PROVIDER_ERROR":
    case "MELIPAYAMAK_NETWORK_ERROR":
    case "MELIPAYAMAK_CREDENTIALS_MISSING":
    case "MELIPAYAMAK_BODY_ID_MISSING":
    case "MELIPAYAMAK_SENDER_MISSING":
    case "MELIPAYAMAK_SMS_PAYLOAD_INVALID":
    case "MELIPAYAMAK_SERVER_ERROR":
    case "MELIPAYAMAK_EMPTY_RESPONSE":
    case "MELIPAYAMAK_SEND_FAILED":
      return "Melipayamak rejected or could not receive the test SMS.";
    case "INTEGRATION_TELEGRAM_TOPIC_THREAD_ID_MISSING":
      return "Telegram registration forum topic is missing from integration config.";
    case "INTEGRATION_TELEGRAM_GROUP_NAME_REQUIRED":
      return "Telegram group name is required before testing the connection.";
    case "INTEGRATION_TELEGRAM_BOT_TOKEN_REQUIRED":
      return "Telegram bot token is required before testing the connection.";
    case "INTEGRATION_TELEGRAM_BOT_TOKEN_INVALID":
      return "Telegram rejected the bot token. Create or copy a valid token from BotFather.";
    case "INTEGRATION_TELEGRAM_CHAT_INVALID":
      return "Telegram could not resolve this group. Check the chat ID and add the bot to the group.";
    case "INTEGRATION_TELEGRAM_BOT_ACCESS_INVALID":
      return "Telegram could not verify the bot in this group. Add it as an administrator and check its permissions.";
    case "INTEGRATION_TELEGRAM_API_UNREACHABLE":
      return "The server could not reach Telegram. Check outbound network access or configure the Telegram relay.";
    case "INTEGRATION_TELEGRAM_RATE_LIMITED":
      return "Telegram temporarily rate-limited this connection. Wait briefly and try again.";
    case "INTEGRATION_TELEGRAM_API_REQUEST_FAILED":
      return "Telegram rejected the request. Check the group, bot permissions, and forum settings.";
    case "INTEGRATION_TELEGRAM_GROUP_MUST_BE_SUPERGROUP":
      return "Telegram notifications require a supergroup.";
    case "INTEGRATION_TELEGRAM_GROUP_MUST_BE_FORUM":
      return "Telegram notifications require topics to be enabled for the supergroup.";
    case "INTEGRATION_TELEGRAM_GROUP_NAME_MISMATCH":
      return "Telegram group name does not match the selected supergroup.";
    case "INTEGRATION_TELEGRAM_BOT_MANAGE_TOPICS_REQUIRED":
      return "Telegram bot must be an administrator with permission to manage topics.";
    case "INTEGRATION_TELEGRAM_TOPIC_CREATE_FAILED":
      return "Telegram forum topics could not be created.";
    case "INTEGRATION_TELEGRAM_TOPIC_CREATE_OUTCOME_UNKNOWN":
      return "A previous topic creation may have succeeded but its response was lost. Rebind explicitly instead of retrying automatically.";
    case "TELEGRAM_HTTP_ERROR":
      return "Telegram API rejected the test message.";
    case "TELEGRAM_SEND_FAILED":
    case "TELEGRAM_API_ERROR":
      return "Telegram API rejected the test message. Check the group ID, token, and bot permissions.";
    case "TELEGRAM_NETWORK_ERROR":
      return "Network error while calling Telegram.";
    default:
      return code !== undefined && code.length > 0
        ? `Test failed (${code}).`
        : "Test connection failed.";
  }
}

export function resolveTelegramProviderTestThreadId(input: {
  readonly config: Record<string, unknown>;
  readonly requireRegistrationTopic: boolean;
}):
  | { readonly ok: true; readonly threadId?: number }
  | { readonly ok: false; readonly code: "INTEGRATION_TELEGRAM_TOPIC_THREAD_ID_MISSING" } {
  const topicThreadIds =
    typeof input.config.topicThreadIds === "object" && input.config.topicThreadIds !== null
      ? (input.config.topicThreadIds as Record<string, unknown>)
      : {};
  const rawThreadId = topicThreadIds.registration;
  if (typeof rawThreadId === "number" && Number.isSafeInteger(rawThreadId) && rawThreadId > 0) {
    return { ok: true, threadId: rawThreadId };
  }
  if (input.requireRegistrationTopic) {
    return { ok: false, code: "INTEGRATION_TELEGRAM_TOPIC_THREAD_ID_MISSING" };
  }
  return { ok: true };
}
