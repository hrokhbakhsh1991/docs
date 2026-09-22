export type TelegramWebhookChat = {
  readonly id: number;
  readonly type: string;
  readonly title?: string;
  readonly is_forum?: boolean;
};

export type TelegramWebhookMessage = {
  readonly message_id: number;
  readonly chat: TelegramWebhookChat;
  readonly text?: string;
  readonly message_thread_id?: number;
  readonly from?: TelegramWebhookUser;
  readonly reply_to_message?: TelegramWebhookMessage;
};

export type TelegramWebhookUser = {
  readonly id: number;
  readonly username?: string;
  readonly first_name?: string;
};

export type TelegramWebhookCallbackQuery = {
  readonly id: string;
  readonly data?: string;
  readonly message?: TelegramWebhookMessage;
  readonly from?: TelegramWebhookUser;
};

export type TelegramWebhookUpdate = {
  readonly update_id: number;
  readonly message?: TelegramWebhookMessage;
  readonly callback_query?: TelegramWebhookCallbackQuery;
};

export type TelegramConnectCommand = {
  readonly code: string;
  readonly chatId: string;
  readonly groupName?: string;
};

export type TelegramReceiptAction = {
  readonly callbackQueryId: string;
  readonly action: "approve" | "reject";
  readonly receiptId: string;
  readonly chatId: string;
  readonly userId: string;
  readonly messageThreadId?: number;
};

export type TelegramRegistrationAction = {
  readonly callbackQueryId: string;
  readonly action: "approve_without_payment" | "approve_with_payment" | "approve" | "waitlist";
  readonly registrationId: string;
  readonly chatId: string;
  readonly userId: string;
  readonly messageThreadId?: number;
};

/** Short wire codes for Telegram callback_data (64-byte limit) → full action names. */
const REGISTRATION_ACTION_WIRE_CODES: Record<
  string,
  TelegramRegistrationAction["action"]
> = {
  apr_np: "approve_without_payment",
  apr_wp: "approve_with_payment",
  apr: "approve",
  wl: "waitlist",
};

export function parseTelegramRegistrationAction(
  update: TelegramWebhookUpdate
): TelegramRegistrationAction | null {
  const callback = update.callback_query;
  const message = callback?.message;
  const from = callback?.from;
  if (
    callback === undefined ||
    message === undefined ||
    from === undefined ||
    message.chat.type !== "supergroup" ||
    typeof callback.data !== "string"
  ) {
    return null;
  }
  // Wire codes are short — Telegram caps callback_data at 64 bytes, which the
  // full action names (e.g. "approve_without_payment") plus a uuid would exceed.
  const match = callback.data.match(
    /^registration:(apr_np|apr_wp|apr|wl):([A-Za-z0-9_-]{8,128})$/i
  );
  if (match === null) return null;
  const action = REGISTRATION_ACTION_WIRE_CODES[match[1]!.toLowerCase()];
  if (action === undefined) return null;
  return {
    callbackQueryId: callback.id,
    action,
    registrationId: match[2]!,
    chatId: String(message.chat.id),
    userId: String(from.id),
    ...(message.message_thread_id === undefined
      ? {}
      : { messageThreadId: message.message_thread_id }),
  };
}

export type TelegramTicketReply = {
  readonly updateId: number;
  readonly messageId: number;
  readonly ticketCode: string;
  readonly body: string;
  readonly chatId: string;
  readonly userId: string;
  readonly messageThreadId: number;
};

export function parseTelegramTicketReply(
  update: TelegramWebhookUpdate
): TelegramTicketReply | null {
  const message = update.message;
  const repliedMessage = message?.reply_to_message;
  const body = message?.text?.trim() ?? "";
  if (
    message === undefined ||
    repliedMessage === undefined ||
    message.from === undefined ||
    message.chat.type !== "supergroup" ||
    message.message_thread_id === undefined ||
    body.length === 0 ||
    typeof repliedMessage.text !== "string"
  ) {
    return null;
  }
  const ticketCode = repliedMessage.text.match(/\bTKT-\d{6}\b/i)?.[0]?.toUpperCase();
  if (ticketCode === undefined) {
    return null;
  }
  return {
    updateId: update.update_id,
    messageId: message.message_id,
    ticketCode,
    body,
    chatId: String(message.chat.id),
    userId: String(message.from.id),
    messageThreadId: message.message_thread_id,
  };
}

export function parseTelegramReceiptAction(
  update: TelegramWebhookUpdate
): TelegramReceiptAction | null {
  const callback = update.callback_query;
  const message = callback?.message;
  const from = callback?.from;
  if (
    callback === undefined ||
    message === undefined ||
    from === undefined ||
    message.chat.type !== "supergroup" ||
    typeof callback.data !== "string"
  ) {
    return null;
  }
  const match = callback.data.match(/^receipt:(approve|reject):([A-Za-z0-9_-]{8,128})$/i);
  if (match === null) return null;
  return {
    callbackQueryId: callback.id,
    action: match[1]!.toLowerCase() as "approve" | "reject",
    receiptId: match[2]!,
    chatId: String(message.chat.id),
    userId: String(from.id),
    ...(message.message_thread_id === undefined
      ? {}
      : { messageThreadId: message.message_thread_id }),
  };
}

/** Extracts only the one-time binding command; all other updates return null. */
export function parseTelegramConnectCommand(
  update: TelegramWebhookUpdate
): TelegramConnectCommand | null {
  const message = update.message;
  if (message === undefined || message.chat.type !== "supergroup" || message.text === undefined) {
    return null;
  }

  const match = message.text.trim().match(/^\/connect(?:@[^\s]+)?\s+([A-Za-z0-9_-]{6,128})$/i);
  if (match === null) return null;

  const groupName = typeof message.chat.title === "string" ? message.chat.title.trim() : "";
  return {
    code: match[1]!,
    chatId: String(message.chat.id),
    ...(groupName.length === 0 ? {} : { groupName }),
  };
}

export function parseTelegramWebhookUpdate(value: unknown): TelegramWebhookUpdate | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const update = value as Record<string, unknown>;
  if (typeof update.update_id !== "number" || !Number.isSafeInteger(update.update_id)) {
    return null;
  }
  return update as unknown as TelegramWebhookUpdate;
}
