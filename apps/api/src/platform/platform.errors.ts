export class PlatformUnauthorized extends Error {
  readonly code = "PLATFORM_UNAUTHORIZED";
  constructor(message = "unauthorized") {
    super(message);
    this.name = "PlatformUnauthorized";
  }
}

export class PlatformForbidden extends Error {
  readonly code = "PLATFORM_FORBIDDEN";
  constructor(message = "forbidden") {
    super(message);
    this.name = "PlatformForbidden";
  }
}

export class PlatformValidation extends Error {
  readonly code = "PLATFORM_VALIDATION";
  constructor(message = "validation") {
    super(message);
    this.name = "PlatformValidation";
  }
}

export class PlatformDefinitionConflict extends Error {
  readonly code = "PLATFORM_DEFINITION_CONFLICT";
  constructor(message = "definition conflict") {
    super(message);
    this.name = "PlatformDefinitionConflict";
  }
}

export class PlatformRendererNotAllowed extends Error {
  readonly code = "PLATFORM_RENDERER_NOT_ALLOWED";
  constructor(readonly rendererId: string) {
    super(`PLATFORM_RENDERER_NOT_ALLOWED:${rendererId}`);
    this.name = "PlatformRendererNotAllowed";
  }
}

export class PlatformFeatureForbidden extends Error {
  readonly code = "PLATFORM_FEATURE_FORBIDDEN";
  constructor(message = "forbidden") {
    super(message);
    this.name = "PlatformFeatureForbidden";
  }
}
