import type { TelegramApiClient, TelegramBotIdentity, TelegramChat } from "./telegram-api.client";
import {
  createTelegramForumConfig,
  type TelegramForumConfig,
  TELEGRAM_FORUM_TOPIC_KEYS,
} from "./telegram-forum.config";

export class TelegramForumOnboardingError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "TelegramForumOnboardingError";
  }
}

export type ProvisionedTelegramForum = {
  readonly bot: TelegramBotIdentity;
  readonly chat: TelegramChat;
  readonly config: TelegramForumConfig;
};

const provisioningLocks = new Map<string, Promise<void>>();

async function withProvisioningLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = provisioningLocks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  provisioningLocks.set(key, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (provisioningLocks.get(key) === queued) {
      provisioningLocks.delete(key);
    }
  }
}

/** Binds one Workspace connection to one Telegram Forum supergroup. */
export async function provisionTelegramForum(input: {
  readonly api: TelegramApiClient;
  readonly config: TelegramForumConfig;
  readonly chatId: string;
  /**
   * Persistence seams make the idempotency boundary include the database
   * write, not only the Telegram API call. Callers backed by a connection
   * should reload and save inside this lock.
   */
  readonly loadConfig?: () => Promise<TelegramForumConfig>;
  readonly saveConfig?: (config: TelegramForumConfig) => Promise<void>;
  /** Persist each newly created topic before continuing to the next one. */
  readonly onTopicCreated?: (
    key: string,
    topic: TelegramForumConfig["topics"][keyof TelegramForumConfig["topics"]]
  ) => Promise<void>;
}): Promise<ProvisionedTelegramForum> {
  return withProvisioningLock(input.chatId, async () => {
    const config = input.loadConfig === undefined ? input.config : await input.loadConfig();
    return provisionTelegramForumLocked({ ...input, config });
  });
}

async function provisionTelegramForumLocked(input: {
  readonly api: TelegramApiClient;
  readonly config: TelegramForumConfig;
  readonly chatId: string;
  readonly saveConfig?: (config: TelegramForumConfig) => Promise<void>;
  readonly onTopicCreated?: (
    key: string,
    topic: TelegramForumConfig["topics"][keyof TelegramForumConfig["topics"]]
  ) => Promise<void>;
}): Promise<ProvisionedTelegramForum> {
  const bot = await input.api.getMe();
  const chat = await input.api.getChat(input.chatId);
  if (chat.type !== "supergroup") {
    throw new TelegramForumOnboardingError("INTEGRATION_TELEGRAM_GROUP_MUST_BE_SUPERGROUP");
  }
  if (chat.is_forum !== true) {
    throw new TelegramForumOnboardingError("INTEGRATION_TELEGRAM_GROUP_MUST_BE_FORUM");
  }
  if (chat.title !== undefined && chat.title.trim() !== input.config.groupName) {
    throw new TelegramForumOnboardingError("INTEGRATION_TELEGRAM_GROUP_NAME_MISMATCH");
  }

  const member = await input.api.getChatMember(input.chatId, bot.id);
  if (member.status !== "administrator" || member.can_manage_topics !== true) {
    throw new TelegramForumOnboardingError("INTEGRATION_TELEGRAM_BOT_MANAGE_TOPICS_REQUIRED");
  }

  const topicEntries: Array<
    readonly [string, TelegramForumConfig["topics"][keyof TelegramForumConfig["topics"]]]
  > = [];
  for (const key of TELEGRAM_FORUM_TOPIC_KEYS) {
    const topic = input.config.topics[key];
    if (topic.threadId !== undefined) {
      topicEntries.push([key, topic]);
      continue;
    }
    try {
      const created = await input.api.createForumTopic(input.chatId, topic.name);
      const createdTopic = { ...topic, threadId: created.message_thread_id };
      topicEntries.push([key, createdTopic]);
      await input.onTopicCreated?.(key, createdTopic);
    } catch {
      throw new TelegramForumOnboardingError("INTEGRATION_TELEGRAM_TOPIC_CREATE_FAILED");
    }
  }

  const result = {
    bot,
    chat,
    config: createTelegramForumConfig({
      groupName: input.config.groupName,
      chatId: input.chatId,
      topics: Object.fromEntries(topicEntries) as TelegramForumConfig["topics"],
    }),
  };
  await input.saveConfig?.(result.config);
  return result;
}
