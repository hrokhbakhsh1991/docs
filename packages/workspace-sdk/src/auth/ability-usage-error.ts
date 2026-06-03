export type AbilityUsageErrorCode = "MISSING_THEME_ACCESS_ARG";

export class AbilityUsageError extends Error {
  readonly code: AbilityUsageErrorCode;

  constructor(code: AbilityUsageErrorCode, message: string) {
    super(message);
    this.name = "AbilityUsageError";
    this.code = code;
  }
}
