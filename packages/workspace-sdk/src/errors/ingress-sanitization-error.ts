export type IngressSanitizationErrorCode =
  | "NON_OBJECT_ROOT"
  | "ROOT_IS_ARRAY"
  | "MAX_DEPTH_EXCEEDED"
  | "FUNCTION_NOT_ALLOWED"
  | "BIGINT_NOT_ALLOWED"
  | "SYMBOL_NOT_ALLOWED"
  | "UNSUPPORTED_PRIMITIVE"
  | "ACCESSOR_PROPERTY"
  | "NON_DATA_DESCRIPTOR"
  | "MISSING_DESCRIPTOR"
  | "PROTOTYPE_INTROSPECTION_TRAP"
  | "UNSTABLE_PROTOTYPE"
  | "NON_PLAIN_PROTOTYPE"
  | "SYMBOL_KEYS"
  | "HIDDEN_NON_ENUMERABLE_KEYS"
  | "ARRAY_NOT_ALLOWED"
  | "ARRAY_LIKE_OBJECT"
  | "INGRESS_REJECTED";

export class IngressSanitizationError extends Error {
  readonly code: IngressSanitizationErrorCode;
  readonly path: string;

  constructor(code: IngressSanitizationErrorCode, message: string, path: string) {
    super(message);
    this.name = "IngressSanitizationError";
    this.code = code;
    this.path = path;
  }
}

/** Maps shield/sanitizer rejection messages to stable ingress codes. */
export function ingressCodeFromShieldMessage(message: string): IngressSanitizationErrorCode {
  if (message.includes("Accessor property")) return "ACCESSOR_PROPERTY";
  if (message.includes("Non-data property descriptor")) return "NON_DATA_DESCRIPTOR";
  if (message.includes("Missing property descriptor")) return "MISSING_DESCRIPTOR";
  if (message.includes("Prototype introspection failed")) return "PROTOTYPE_INTROSPECTION_TRAP";
  if (message.includes("Unstable prototype")) return "UNSTABLE_PROTOTYPE";
  if (message.includes("Non-plain object")) return "NON_PLAIN_PROTOTYPE";
  if (message.includes("BigInt is not allowed")) return "BIGINT_NOT_ALLOWED";
  if (message.includes("Symbol is not allowed")) return "SYMBOL_NOT_ALLOWED";
  if (message.includes("Function is not allowed")) return "FUNCTION_NOT_ALLOWED";
  if (message.includes("Symbol keys are not allowed")) return "SYMBOL_KEYS";
  if (message.includes("Hidden non-enumerable")) return "HIDDEN_NON_ENUMERABLE_KEYS";
  if (message.includes("Array-like plain object")) return "ARRAY_LIKE_OBJECT";
  if (message.includes("Arrays are not allowed")) return "ARRAY_NOT_ALLOWED";
  if (message.includes("Max depth exceeded")) return "MAX_DEPTH_EXCEEDED";
  if (message.includes("Unsupported value")) return "UNSUPPORTED_PRIMITIVE";
  return "INGRESS_REJECTED";
}
