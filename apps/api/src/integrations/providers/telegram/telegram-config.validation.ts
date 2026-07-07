export class TelegramIntegrationValidationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "TelegramIntegrationValidationError";
  }
}

export type NormalizedTelegramCreateInput = {
  readonly config: {
    readonly channelId: string;
  };
  readonly credentials: {
    readonly botToken: string;
  };
};

export function normalizeTelegramCreateInput(input: {
  readonly config: Record<string, unknown>;
  readonly botToken: unknown;
}): NormalizedTelegramCreateInput {
  const channelId = readRequiredString(
    input.config.channelId,
    "INTEGRATION_TELEGRAM_CHANNEL_ID_REQUIRED"
  );
  const botToken = readRequiredString(input.botToken, "INTEGRATION_TELEGRAM_BOT_TOKEN_REQUIRED");

  return {
    config: { channelId },
    credentials: { botToken },
  };
}

export function normalizeTelegramPatchConfig(config: Record<string, unknown>): {
  readonly channelId: string;
} {
  return {
    channelId: readRequiredString(config.channelId, "INTEGRATION_TELEGRAM_CHANNEL_ID_REQUIRED"),
  };
}

function readRequiredString(value: unknown, code: string): string {
  if (typeof value !== "string") {
    throw new TelegramIntegrationValidationError(code);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new TelegramIntegrationValidationError(code);
  }
  return trimmed;
}
