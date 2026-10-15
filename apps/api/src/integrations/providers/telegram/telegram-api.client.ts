import { randomUUID } from "node:crypto";

import { buildTelegramApiRequest } from "./telegram-api.transport";

type TelegramApiResponse<T> = {
  readonly ok: boolean;
  readonly result?: T;
  readonly description?: string;
  readonly error_code?: number;
};

// The Cloudflare relay can cold-start before forwarding the first Bot API call.
// Keep the timeout bounded, but allow that first request to complete without
// turning a healthy relay into a false "unreachable" provisioning failure.
const TELEGRAM_API_TIMEOUT_MS = 30_000;
const TELEGRAM_READ_ONLY_METHODS = new Set(["getMe", "getChat", "getChatMember", "getWebhookInfo"]);
const TELEGRAM_MAX_ATTEMPTS = 3;
const TELEGRAM_RETRY_BASE_DELAY_MS = 100;

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

export type TelegramWebhookInfo = {
  readonly url: string;
  readonly has_custom_certificate: boolean;
  readonly pending_update_count: number;
  readonly last_error_date?: number;
  readonly last_error_message?: string;
};

export type TelegramSentMessage = {
  readonly message_id: number;
};

export class TelegramApiError extends Error {
  constructor(
    readonly method: string,
    readonly errorCode?: number,
    readonly description?: string,
    readonly httpStatus?: number
  ) {
    super(description ?? `Telegram API request failed: ${method}`);
    this.name = "TelegramApiError";
  }
}

export function classifyTelegramApiError(error: TelegramApiError): string {
  if (
    error.errorCode === undefined ||
    error.httpStatus === 502 ||
    error.httpStatus === 503 ||
    error.httpStatus === 504
  ) {
    return "INTEGRATION_TELEGRAM_API_UNREACHABLE";
  }
  if (error.errorCode === 401) {
    return "INTEGRATION_TELEGRAM_BOT_TOKEN_INVALID";
  }
  if (error.method === "getChat" && (error.errorCode === 400 || error.errorCode === 403)) {
    return "INTEGRATION_TELEGRAM_CHAT_INVALID";
  }
  if (error.method === "getChatMember" && (error.errorCode === 400 || error.errorCode === 403)) {
    return "INTEGRATION_TELEGRAM_BOT_ACCESS_INVALID";
  }
  if (error.errorCode === 429 || error.httpStatus === 429) {
    return "INTEGRATION_TELEGRAM_RATE_LIMITED";
  }
  return "INTEGRATION_TELEGRAM_API_REQUEST_FAILED";
}

export type TelegramApiClient = {
  getMe(): Promise<TelegramBotIdentity>;
  getChat(chatId: string): Promise<TelegramChat>;
  getChatMember(chatId: string, userId: number): Promise<TelegramChatMember>;
  getWebhookInfo(): Promise<TelegramWebhookInfo>;
  createForumTopic(chatId: string, name: string): Promise<TelegramForumTopic>;
  setWebhook(url: string, secretToken?: string): Promise<void>;
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void>;
  sendChatAction?(input: {
    readonly chatId: string;
    readonly action: "typing";
    readonly messageThreadId?: number;
  }): Promise<void>;
  sendMessage(input: {
    readonly chatId: string;
    readonly text: string;
    readonly messageThreadId?: number;
  }): Promise<TelegramSentMessage>;
};

export type TelegramApiClientOptions = {
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly random?: () => number;
  readonly requestId?: () => string;
};

export type TelegramReadOnlyDiagnostic = {
  readonly status: "ok" | "error" | "skipped";
  readonly code?: string;
};

export type TelegramReadOnlyDiagnostics = {
  readonly ok: boolean;
  readonly methods: {
    readonly getMe: TelegramReadOnlyDiagnostic;
    readonly getChat: TelegramReadOnlyDiagnostic;
    readonly getChatMember: TelegramReadOnlyDiagnostic;
    readonly getWebhookInfo: TelegramReadOnlyDiagnostic;
  };
  readonly bot?: {
    readonly id: number;
    readonly username?: string;
  };
  readonly chat?: {
    readonly id: number;
    readonly type: string;
    readonly isForum: boolean;
  };
  readonly member?: {
    readonly status: string;
    readonly canManageTopics: boolean;
  };
  readonly webhook?: {
    readonly configured: boolean;
    readonly pendingUpdateCount: number;
  };
};

function diagnosticError(error: unknown): TelegramReadOnlyDiagnostic {
  if (error instanceof TelegramApiError) {
    return { status: "error", code: classifyTelegramApiError(error) };
  }
  return { status: "error", code: "INTEGRATION_TELEGRAM_API_UNREACHABLE" };
}

export async function runTelegramReadOnlyDiagnostics(
  client: TelegramApiClient,
  chatId: string
): Promise<TelegramReadOnlyDiagnostics> {
  let bot: TelegramBotIdentity | undefined;
  let chat: TelegramChat | undefined;
  let member: TelegramChatMember | undefined;
  let webhook: TelegramWebhookInfo | undefined;

  let getMe: TelegramReadOnlyDiagnostic = { status: "skipped" };
  let getChat: TelegramReadOnlyDiagnostic = { status: "skipped" };
  let getChatMember: TelegramReadOnlyDiagnostic = { status: "skipped" };
  let getWebhookInfo: TelegramReadOnlyDiagnostic = { status: "skipped" };

  try {
    bot = await client.getMe();
    getMe = { status: "ok" };
  } catch (error: unknown) {
    getMe = diagnosticError(error);
  }
  try {
    chat = await client.getChat(chatId);
    getChat = { status: "ok" };
  } catch (error: unknown) {
    getChat = diagnosticError(error);
  }
  if (bot !== undefined) {
    try {
      member = await client.getChatMember(chatId, bot.id);
      getChatMember = { status: "ok" };
    } catch (error: unknown) {
      getChatMember = diagnosticError(error);
    }
  }
  try {
    webhook = await client.getWebhookInfo();
    getWebhookInfo = { status: "ok" };
  } catch (error: unknown) {
    getWebhookInfo = diagnosticError(error);
  }

  const methods = { getMe, getChat, getChatMember, getWebhookInfo };
  return {
    ok: Object.values(methods).every((method) => method.status === "ok"),
    methods,
    ...(bot === undefined
      ? {}
      : { bot: { id: bot.id, ...(bot.username ? { username: bot.username } : {}) } }),
    ...(chat === undefined
      ? {}
      : { chat: { id: chat.id, type: chat.type, isForum: chat.is_forum === true } }),
    ...(member === undefined
      ? {}
      : {
          member: {
            status: member.status,
            canManageTopics: member.can_manage_topics === true,
          },
        }),
    ...(webhook === undefined
      ? {}
      : {
          webhook: {
            configured: webhook.url.length > 0,
            pendingUpdateCount: webhook.pending_update_count,
          },
        }),
  };
}

export function createTelegramApiClient(
  botToken: string,
  fetchImpl: typeof fetch = fetch,
  options: TelegramApiClientOptions = {}
): TelegramApiClient {
  const token = botToken.trim();
  if (token.length === 0) {
    throw new TelegramApiError("client", undefined, "Telegram bot token is required");
  }

  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      }));
  const random = options.random ?? Math.random;

  async function callOnce<T>(
    method: string,
    body: Record<string, unknown>,
    requestId: string
  ): Promise<T> {
    const request = buildTelegramApiRequest(token, method, body, requestId);
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

    let result: TelegramApiResponse<T>;
    try {
      result = (await response.json()) as TelegramApiResponse<T>;
    } catch {
      throw new TelegramApiError(
        method,
        undefined,
        "Telegram API returned invalid JSON",
        response.status
      );
    }
    if (!response.ok || result.ok !== true || result.result === undefined) {
      throw new TelegramApiError(
        method,
        result.error_code,
        result.description ?? `Telegram API request failed: ${method}`,
        response.status
      );
    }
    return result.result;
  }

  async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const requestId = options.requestId?.() ?? randomUUID();
    const retryable = TELEGRAM_READ_ONLY_METHODS.has(method);
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await callOnce<T>(method, body, requestId);
      } catch (error: unknown) {
        const telegramError =
          error instanceof TelegramApiError
            ? error
            : new TelegramApiError(method, undefined, "Telegram API is unreachable");
        const transportFailure =
          telegramError.errorCode === undefined &&
          (telegramError.httpStatus === undefined ||
            telegramError.httpStatus === 502 ||
            telegramError.httpStatus === 503 ||
            telegramError.httpStatus === 504);
        if (!retryable || !transportFailure || attempt >= TELEGRAM_MAX_ATTEMPTS) {
          throw telegramError;
        }
        const backoff = TELEGRAM_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        await sleep(Math.round(backoff + random() * TELEGRAM_RETRY_BASE_DELAY_MS));
      }
    }
  }

  return {
    getMe: () => call<TelegramBotIdentity>("getMe", {}),
    getChat: (chatId) => call<TelegramChat>("getChat", { chat_id: chatId }),
    getChatMember: (chatId, userId) =>
      call<TelegramChatMember>("getChatMember", { chat_id: chatId, user_id: userId }),
    getWebhookInfo: () => call<TelegramWebhookInfo>("getWebhookInfo", {}),
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
    sendChatAction: async (input) => {
      await call<boolean>("sendChatAction", {
        chat_id: input.chatId,
        action: input.action,
        ...(input.messageThreadId === undefined
          ? {}
          : { message_thread_id: input.messageThreadId }),
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
