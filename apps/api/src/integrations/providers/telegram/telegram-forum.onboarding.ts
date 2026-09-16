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

/** Binds one Workspace connection to one Telegram Forum supergroup. */
export async function provisionTelegramForum(input: {
  readonly api: TelegramApiClient;
  readonly config: TelegramForumConfig;
  readonly chatId: string;
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
      topicEntries.push([key, { ...topic, threadId: created.message_thread_id }]);
    } catch {
      throw new TelegramForumOnboardingError("INTEGRATION_TELEGRAM_TOPIC_CREATE_FAILED");
    }
  }

  return {
    bot,
    chat,
    config: createTelegramForumConfig({
      groupName: input.config.groupName,
      chatId: input.chatId,
      topics: Object.fromEntries(topicEntries) as TelegramForumConfig["topics"],
    }),
  };
}
