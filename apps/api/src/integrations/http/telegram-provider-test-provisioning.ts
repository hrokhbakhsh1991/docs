import {
  createTelegramApiClient,
  TelegramApiError,
  type TelegramApiClient,
} from "../providers/telegram/telegram-api.client";
import {
  createTelegramForumConfig,
  TELEGRAM_FORUM_TOPIC_KEYS,
} from "../providers/telegram/telegram-forum.config";
import {
  provisionTelegramForum,
  TelegramForumOnboardingError,
} from "../providers/telegram/telegram-forum.onboarding";
import { resolveTelegramProviderTestThreadId } from "./integrations-verification";

export type TelegramProviderTestProvisioningResult =
  | {
      readonly ok: true;
      readonly config: Record<string, unknown>;
      readonly threadId: number;
      readonly provisioned: boolean;
    }
  | { readonly ok: false; readonly code: string };

export type DeadTelegramDeliveryJobCandidate = {
  readonly id: string;
  readonly payload: unknown;
  readonly lastError: unknown;
};

function hasAllTelegramForumTopics(config: Record<string, unknown>): boolean {
  const topicThreadIds =
    typeof config.topicThreadIds === "object" && config.topicThreadIds !== null
      ? (config.topicThreadIds as Record<string, unknown>)
      : {};
  return TELEGRAM_FORUM_TOPIC_KEYS.every((key) => {
    const threadId = topicThreadIds[key];
    return typeof threadId === "number" && Number.isSafeInteger(threadId) && threadId > 0;
  });
}

/**
 * Select only notifications that became dead because forum topics were not
 * configured yet. Other failures must remain dead and require their own
 * operator decision; replaying them here could duplicate messages.
 */
export function selectTelegramTopicRecoveryJobIds(input: {
  readonly connectionId: string;
  readonly config: Record<string, unknown>;
  readonly jobs: readonly DeadTelegramDeliveryJobCandidate[];
}): readonly string[] {
  const topicThreadIds =
    typeof input.config.topicThreadIds === "object" && input.config.topicThreadIds !== null
      ? (input.config.topicThreadIds as Record<string, unknown>)
      : {};

  return input.jobs
    .filter((job) => {
      const payload =
        typeof job.payload === "object" && job.payload !== null
          ? (job.payload as Record<string, unknown>)
          : {};
      const lastError =
        typeof job.lastError === "object" && job.lastError !== null
          ? (job.lastError as Record<string, unknown>)
          : {};
      const topicKey = payload.telegramTopicKey;
      const threadId = typeof topicKey === "string" ? topicThreadIds[topicKey] : undefined;
      return (
        payload.integrationConnectionId === input.connectionId &&
        lastError.code === "INTEGRATION_TELEGRAM_TOPIC_THREAD_ID_MISSING" &&
        typeof topicKey === "string" &&
        typeof threadId === "number" &&
        Number.isSafeInteger(threadId) &&
        threadId > 0
      );
    })
    .map((job) => job.id);
}

export async function ensureTelegramProviderTestRegistrationTopic(input: {
  readonly config: Record<string, unknown>;
  readonly credentials: Record<string, unknown>;
  readonly createApiClient?: (botToken: string) => TelegramApiClient;
}): Promise<TelegramProviderTestProvisioningResult> {
  const existing = resolveTelegramProviderTestThreadId({
    config: input.config,
    requireRegistrationTopic: true,
  });
  if (existing.ok && existing.threadId !== undefined && hasAllTelegramForumTopics(input.config)) {
    return { ok: true, config: input.config, threadId: existing.threadId, provisioned: false };
  }

  const botToken = typeof input.credentials.botToken === "string" ? input.credentials.botToken : "";
  if (botToken.trim().length === 0) {
    return { ok: false, code: "INTEGRATION_TELEGRAM_BOT_TOKEN_REQUIRED" };
  }

  const chatId =
    typeof input.config.chatId === "string"
      ? input.config.chatId.trim()
      : typeof input.config.channelId === "string"
        ? input.config.channelId.trim()
        : "";
  if (chatId.length === 0) {
    return { ok: false, code: "INTEGRATION_CONFIG_INCOMPLETE" };
  }

  const groupName = typeof input.config.groupName === "string" ? input.config.groupName.trim() : "";
  if (groupName.length === 0) {
    return { ok: false, code: "INTEGRATION_TELEGRAM_GROUP_NAME_REQUIRED" };
  }

  try {
    const provisioned = await provisionTelegramForum({
      api: (input.createApiClient ?? createTelegramApiClient)(botToken),
      config: createTelegramForumConfig({
        groupName,
        chatId,
        topics: readTelegramTopicConfig(input.config),
      }),
      chatId,
    });
    const topicThreadIds = Object.fromEntries(
      Object.entries(provisioned.config.topics)
        .filter(([, topic]) => topic.threadId !== undefined)
        .map(([key, topic]) => [key, topic.threadId])
    );
    const topicNames = Object.fromEntries(
      Object.entries(provisioned.config.topics).map(([key, topic]) => [key, topic.name])
    );
    const config = {
      ...input.config,
      groupName,
      chatId,
      topicThreadIds,
      topicNames,
      botId: provisioned.bot.id,
      ...(provisioned.bot.username === undefined ? {} : { botUsername: provisioned.bot.username }),
    };
    const registration = resolveTelegramProviderTestThreadId({
      config,
      requireRegistrationTopic: true,
    });
    if (!registration.ok || registration.threadId === undefined) {
      return { ok: false, code: "INTEGRATION_TELEGRAM_TOPIC_THREAD_ID_MISSING" };
    }
    return { ok: true, config, threadId: registration.threadId, provisioned: true };
  } catch (error: unknown) {
    if (error instanceof TelegramForumOnboardingError) {
      return { ok: false, code: error.code };
    }
    if (error instanceof TelegramApiError) {
      return {
        ok: false,
        code: error.errorCode === undefined ? "TELEGRAM_NETWORK_ERROR" : "TELEGRAM_HTTP_ERROR",
      };
    }
    throw error;
  }
}

export function readTelegramTopicConfig(config: Record<string, unknown>): Record<string, unknown> {
  const names =
    typeof config.topicNames === "object" && config.topicNames !== null
      ? (config.topicNames as Record<string, unknown>)
      : {};
  const ids =
    typeof config.topicThreadIds === "object" && config.topicThreadIds !== null
      ? (config.topicThreadIds as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    ["registration", "receipts", "tickets"].map((key) => [
      key,
      {
        ...(typeof names[key] === "string" ? { name: names[key] } : {}),
        ...(typeof ids[key] === "number" ? { threadId: ids[key] } : {}),
      },
    ])
  );
}
