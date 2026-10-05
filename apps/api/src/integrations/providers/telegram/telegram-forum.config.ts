export const TELEGRAM_FORUM_TOPIC_KEYS = ["registration", "receipts", "tickets", "tours"] as const;

export type TelegramForumTopicKey = (typeof TELEGRAM_FORUM_TOPIC_KEYS)[number];

export type TelegramForumTopicConfig = {
  readonly name: string;
  readonly threadId?: number;
};

export type TelegramForumConfig = {
  /** Human-readable value entered by the Workspace owner. */
  readonly groupName: string;
  /** Telegram's stable routing identifier; populated after onboarding. */
  readonly chatId?: string;
  readonly topics: Readonly<Record<TelegramForumTopicKey, TelegramForumTopicConfig>>;
};

export const DEFAULT_TELEGRAM_FORUM_TOPIC_NAMES: Readonly<Record<TelegramForumTopicKey, string>> =
  Object.freeze({
    registration: "ثبت‌نام‌های جدید",
    receipts: "بررسی فیش‌ها",
    tickets: "تیکت‌ها",
    tours: "تورهای جدید",
  });

export function createTelegramForumConfig(input: {
  readonly groupName: unknown;
  readonly chatId?: unknown;
  readonly topics?: Partial<Record<TelegramForumTopicKey, unknown>>;
}): TelegramForumConfig {
  const groupName = readRequiredString(input.groupName, "INTEGRATION_TELEGRAM_GROUP_NAME_REQUIRED");
  const chatId = readOptionalString(input.chatId);
  const topics = {} as Record<TelegramForumTopicKey, TelegramForumTopicConfig>;

  for (const key of TELEGRAM_FORUM_TOPIC_KEYS) {
    const supplied = input.topics?.[key];
    const suppliedRecord =
      typeof supplied === "object" && supplied !== null
        ? (supplied as Record<string, unknown>)
        : undefined;
    const name =
      readOptionalString(suppliedRecord?.name) ?? DEFAULT_TELEGRAM_FORUM_TOPIC_NAMES[key];
    const threadId = readOptionalPositiveInteger(suppliedRecord?.threadId);
    topics[key] = threadId === undefined ? { name } : { name, threadId };
  }

  return chatId === undefined ? { groupName, topics } : { groupName, chatId, topics };
}

export function resolveTelegramForumThreadId(
  config: TelegramForumConfig,
  topic: TelegramForumTopicKey
): number | undefined {
  return config.topics[topic].threadId;
}

function readRequiredString(value: unknown, code: string): string {
  const result = readOptionalString(value);
  if (result === undefined) {
    throw new Error(code);
  }
  return result;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.trim();
  return result.length === 0 ? undefined : result;
}

function readOptionalPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}
