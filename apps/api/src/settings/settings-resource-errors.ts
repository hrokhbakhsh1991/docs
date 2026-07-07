export class SettingsResourceInvalidError extends Error {
  readonly code = "SETTINGS_RESOURCE_INVALID" as const;

  constructor() {
    super("SETTINGS_RESOURCE_INVALID");
    this.name = "SettingsResourceInvalidError";
  }
}
