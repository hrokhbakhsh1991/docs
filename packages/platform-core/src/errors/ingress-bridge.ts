import {
  CanonicalDocumentValidationError,
  IngressSanitizationError,
} from "@app-tour/workspace-sdk/ingress";

import { PlatformCoreError, type PlatformCoreErrorCode } from "./platform-core.error";
import { INGRESS_SANITIZATION_TO_PLATFORM } from "./ingress-sanitization-map";
import { platformErr, type PlatformResult } from "./platform-result";

function mapCanonicalValidationCode(
  code: CanonicalDocumentValidationError["code"],
): PlatformCoreErrorCode {
  switch (code) {
    case "CANONICAL_INVALID_SCHEMA_VERSION":
      return "CANONICAL_INVALID_SCHEMA_VERSION";
    case "CANONICAL_INVALID_ROOTS":
      return "CANONICAL_INVALID_ROOTS";
    case "CANONICAL_DUPLICATE_ROOT":
      return "CANONICAL_DUPLICATE_ROOT";
    case "CANONICAL_INVALID_DATA":
      return "CANONICAL_INVALID_DATA";
    case "CANONICAL_ROOT_UNKNOWN":
      return "CANONICAL_ROOT_UNKNOWN";
    case "CANONICAL_MAX_DEPTH_EXCEEDED":
      return "CANONICAL_MAX_DEPTH_EXCEEDED";
    case "CANONICAL_FORBIDDEN_BIGINT":
      return "CANONICAL_FORBIDDEN_BIGINT";
    case "CANONICAL_FORBIDDEN_SYMBOL":
      return "CANONICAL_FORBIDDEN_SYMBOL";
    case "CANONICAL_TOO_MANY_KEYS":
      return "CANONICAL_TOO_MANY_KEYS";
    case "CANONICAL_FORBIDDEN_KEY":
      return "CANONICAL_FORBIDDEN_KEY";
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

export function mapCanonicalIngressFailure(
  error: unknown,
): PlatformResult<never> | null {
  if (error instanceof CanonicalDocumentValidationError) {
    const platformCode = mapCanonicalValidationCode(error.code);
    return platformErr(
      new PlatformCoreError(platformCode, error.message, { ingress: "canonical" }),
    );
  }
  if (error instanceof IngressSanitizationError) {
    const platformCode = INGRESS_SANITIZATION_TO_PLATFORM[error.code];
    return platformErr(
      new PlatformCoreError(platformCode, error.message, {
        ingressCode: error.code,
        path: error.path,
        surface: "canonical",
      }),
    );
  }
  return null;
}

export function validationResultFromPlatformError(error: PlatformCoreError): {
  readonly ok: false;
  readonly violations: readonly { code: string; message: string }[];
} {
  return {
    ok: false,
    violations: [{ code: error.code, message: error.message }],
  };
}
