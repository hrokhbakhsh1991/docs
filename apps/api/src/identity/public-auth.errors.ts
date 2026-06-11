export const DISPLAY_NAME_REQUIRED = "DISPLAY_NAME_REQUIRED";

export class DisplayNameRequiredError extends Error {
  readonly code = DISPLAY_NAME_REQUIRED;

  constructor() {
    super(DISPLAY_NAME_REQUIRED);
    this.name = "DisplayNameRequiredError";
  }
}
