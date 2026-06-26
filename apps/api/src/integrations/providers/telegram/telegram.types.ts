export type TelegramConnectionCredentials = {
  readonly botToken: string;
};

export type TelegramConnectionConfig = {
  readonly channelId: string;
};

export const TELEGRAM_API_HOST = "api.telegram.org";
