export type WorkspaceCodedErrorOptions = {
  readonly code: string;
  readonly name: string;
  readonly httpStatus?: number;
  /** When true, constructor requires `surface: string`. */
  readonly withSurface?: boolean;
};

export type WorkspaceCodedErrorInstance = Error & {
  readonly code: string;
  readonly httpStatus?: number;
  readonly surface?: string;
};

export function isWorkspaceCodedError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === code
  );
}

type OwnerRequiredCtor = new (surface: string) => WorkspaceCodedErrorInstance & {
  readonly surface: string;
};

type SimpleCtor = new () => WorkspaceCodedErrorInstance;

export type DefinedWorkspaceCodedErrorWithSurface = {
  readonly code: string;
  readonly ErrorClass: OwnerRequiredCtor;
  readonly isError: (error: unknown) => boolean;
};

export type DefinedWorkspaceCodedErrorSimple = {
  readonly code: string;
  readonly ErrorClass: SimpleCtor;
  readonly isError: (error: unknown) => boolean;
};

/**
 * Product workspaces keep stable `CODE` strings for manifest `httpErrors`.
 * This factory only removes rename-clone class/predicate boilerplate.
 */
export function defineWorkspaceCodedError(
  options: WorkspaceCodedErrorOptions & { readonly withSurface: true },
): DefinedWorkspaceCodedErrorWithSurface;
export function defineWorkspaceCodedError(
  options: WorkspaceCodedErrorOptions & { readonly withSurface?: false },
): DefinedWorkspaceCodedErrorSimple;
export function defineWorkspaceCodedError(
  options: WorkspaceCodedErrorOptions,
): DefinedWorkspaceCodedErrorWithSurface | DefinedWorkspaceCodedErrorSimple {
  const code = options.code;
  const httpStatus = options.httpStatus;

  if (options.withSurface === true) {
    class WorkspaceOwnerRequiredError extends Error {
      readonly code = code;
      readonly surface: string;
      readonly httpStatus?: number;

      constructor(surface: string) {
        super(code);
        this.name = options.name;
        this.surface = surface;
        if (httpStatus !== undefined) {
          this.httpStatus = httpStatus;
        }
      }
    }

    return {
      code,
      ErrorClass: WorkspaceOwnerRequiredError,
      isError: (error: unknown) =>
        error instanceof WorkspaceOwnerRequiredError || isWorkspaceCodedError(error, code),
    };
  }

  class WorkspaceCodedError extends Error {
    readonly code = code;
    readonly httpStatus?: number;

    constructor() {
      super(code);
      this.name = options.name;
      if (httpStatus !== undefined) {
        this.httpStatus = httpStatus;
      }
    }
  }

  return {
    code,
    ErrorClass: WorkspaceCodedError,
    isError: (error: unknown) =>
      error instanceof WorkspaceCodedError || isWorkspaceCodedError(error, code),
  };
}
