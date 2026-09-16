import { buildTelegramApiRequest } from "./telegram-api.transport";

type TelegramApiResponse<T> = {
  readonly ok: boolean;
  readonly result?: T;
  readonly description?: string;
  readonly error_code?: number;
};

const TELEGRAM_API_TIMEOUT_MS = 15_000;

export type TelegramBotIdentity = {
  readonly id: number;
  readonly is_bot: boolean;
  readonly first_name: string;
  readonly username?: string;
};

export type TelegramChat = {
  readonly id: number;
  readonly type: string;
  readonly title?: string;
  readonly is_forum?: boolean;
};

export type TelegramForumTopic = {
  readonly message_thread_id: number;
  readonly name: string;
};

export type TelegramChatMember = {
  readonly status: string;
  readonly user?: TelegramBotIdentity;
  readonly can_manage_topics?: boolean;
};

export type TelegramSentMessage = {
  readonly message_id: number;
};

export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly errorCode?: number,
    readonly description?: string
  ) {
    super(description ?? `Telegram API request failed: ${method}`);
    this.name = "TelegramApiError";
  }
}

export type TelegramApiClient = {
  getMe(): Promise<TelegramBotIdentity>;
  getChat(chatId: string): Promise<TelegramChat>;
  getChatMember(chatId: string, userId: number): Promise<TelegramChatMember>;
  createForumTopic(chatId: string, name: string): Promise<TelegramForumTopic>;
  setWebhook(url: string, secretToken?: string): Promise<void>;
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
  sendMessage(input: {
    readonly chatId: string;
    readonly text: string;
    readonly messageThreadId?: number;
  }): Promise<TelegramSentMessage>;
};

export function createTelegramApiClient(
  botToken: string,
  fetchImpl: typeof fetch = fetch
): TelegramApiClient {
  const token = botToken.trim();
  if (token.length === 0) {
    throw new TelegramApiError("client", undefined, "Telegram bot token is required");
  }

  async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const request = buildTelegramApiRequest(token, method, body);
    let response: Response;
    try {
      response = await fetchImpl(request.url, {
        method: "POST",
        headers: request.headers,
        body: request.body,
        signal: AbortSignal.timeout(TELEGRAM_API_TIMEOUT_MS),
      });
    } catch {
      throw new TelegramApiError(method, undefined, "Telegram API is unreachable");
    }
    const result = (await response.json()) as TelegramApiResponse<T>;
    if (!response.ok || result.ok !== true || result.result === undefined) {
      throw new TelegramApiError(method, result.error_code, result.description);
    }
    return result.result;
  }

  return {
    getMe: () => call<TelegramBotIdentity>("getMe", {}),
    getChat: (chatId) => call<TelegramChat>("getChat", { chat_id: chatId }),
    getChatMember: (chatId, userId) =>
      call<TelegramChatMember>("getChatMember", { chat_id: chatId, user_id: userId }),
    createForumTopic: (chatId, name) =>
      call<TelegramForumTopic>("createForumTopic", { chat_id: chatId, name }),
    setWebhook: async (url, secretToken) => {
      await call<boolean>("setWebhook", {
        url,
        ...(secretToken === undefined ? {} : { secret_token: secretToken }),
      });
    },
    answerCallbackQuery: async (callbackQueryId, text) => {
      await call<boolean>("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        ...(text === undefined ? {} : { text }),
      });
    },
    sendMessage: (input) =>
      call<TelegramSentMessage>("sendMessage", {
        chat_id: input.chatId,
        text: input.text,
        ...(input.messageThreadId === undefined
          ? {}
          : { message_thread_id: input.messageThreadId }),
      }),
  };
}
