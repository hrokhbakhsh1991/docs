/** Discriminated union — non-throwing boundary for public parse/validate APIs. */
export type SdkResult<T, C extends string> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: C;
        readonly message: string;
        readonly path?: string;
        readonly cause?: { readonly domain: "canonical"; readonly code: string };
      };
    };

export function sdkOk<T>(value: T): SdkResult<T, never> {
  return { ok: true, value };
}

export function sdkErr<C extends string>(
  code: C,
  message: string,
  pathOrCause?: string | { readonly domain: "canonical"; readonly code: string },
  cause?: { readonly domain: "canonical"; readonly code: string },
): SdkResult<never, C> {
  if (typeof pathOrCause === "object" && pathOrCause !== null) {
    return { ok: false, error: { code, message, cause: pathOrCause } };
  }
  const path = pathOrCause;
  if (path === undefined && cause === undefined) {
    return { ok: false, error: { code, message } };
  }
  if (path === undefined) {
    return { ok: false, error: { code, message, cause } };
  }
  return { ok: false, error: { code, message, path, cause } };
}

export function throwSdkResult<T, C extends string>(
  result: SdkResult<T, C>,
  throwError: (error: SdkResult<T, C> & { ok: false }) => never,
): T {
  if (!result.ok) {
    throwError(result);
  }
  return result.value;
}
