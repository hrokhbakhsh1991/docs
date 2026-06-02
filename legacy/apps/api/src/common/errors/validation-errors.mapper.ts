import { GlobalErrorTaxonomy } from "@repo/shared";

/** Field-level validation item returned in API error `details.validationErrors`. */
export type ValidationFieldError = {
  path: string;
  code: string;
  message: string;
};

type ClassValidatorError = {
  property?: unknown;
  constraints?: Record<string, string>;
  children?: ClassValidatorError[];
};

const PROPERTY_UNKNOWN_RE = /^property (\S+) should not exist$/i;

/**
 * Maps Nest ValidationPipe / class-validator payloads into structured field errors.
 */
export function mapValidationPipeErrors(body: { message: unknown[] }): ValidationFieldError[] {
  const mapped: ValidationFieldError[] = [];

  for (const item of body.message) {
    if (typeof item === "string") {
      mapped.push(mapValidationString(item));
      continue;
    }
    if (item && typeof item === "object") {
      mapped.push(...flattenClassValidatorError(item as ClassValidatorError, ""));
    }
  }

  return mapped;
}

function flattenClassValidatorError(error: ClassValidatorError, parentPath: string): ValidationFieldError[] {
  const property = typeof error.property === "string" ? error.property.trim() : "";
  const path = parentPath && property ? `${parentPath}.${property}` : property || parentPath || "body";

  const results: ValidationFieldError[] = [];

  if (error.constraints && typeof error.constraints === "object") {
    for (const [constraintKey, message] of Object.entries(error.constraints)) {
      if (typeof message !== "string" || message.trim() === "") {
        continue;
      }
      results.push({
        path,
        code: constraintKeyToCode(constraintKey, message),
        message: message.trim(),
      });
    }
  }

  if (Array.isArray(error.children)) {
    for (const child of error.children) {
      results.push(...flattenClassValidatorError(child, path));
    }
  }

  if (results.length === 0 && property) {
    results.push({
      path,
      code: GlobalErrorTaxonomy.VALIDATION.FAILED,
      message: `Validation failed for ${path}`,
    });
  }

  return results;
}

function mapValidationString(message: string): ValidationFieldError {
  const trimmed = message.trim();
  const unknownField = PROPERTY_UNKNOWN_RE.exec(trimmed);
  if (unknownField) {
    return {
      path: unknownField[1],
      code: "VALIDATION_UNKNOWN_FIELD",
      message: trimmed,
    };
  }

  const path = extractPathFromValidationMessage(trimmed);
  return {
    path,
    code: inferCodeFromValidationMessage(trimmed),
    message: trimmed,
  };
}

function extractPathFromValidationMessage(message: string): string {
  const leadingPath = message.match(/^([\w.]+)\s+(?:must|should|cannot|is|has|was)\b/i);
  if (leadingPath?.[1]) {
    return leadingPath[1];
  }
  return "body";
}

function inferCodeFromValidationMessage(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("should not be empty") ||
    lower.includes("must not be empty") ||
    lower.includes("should not be null") ||
    lower.includes("must not be null") ||
    lower.includes("should not be undefined")
  ) {
    return GlobalErrorTaxonomy.VALIDATION.REQUIRED_FIELD_MISSING;
  }
  if (lower.includes("must be one of the following") || lower.includes("must be a valid enum")) {
    return GlobalErrorTaxonomy.VALIDATION.ENUM_INVALID;
  }
  if (lower.includes("should not exist")) {
    return "VALIDATION_UNKNOWN_FIELD";
  }
  if (
    lower.includes("must be") ||
    lower.includes("must match") ||
    lower.includes("must contain") ||
    lower.includes("must be an") ||
    lower.includes("must be a valid")
  ) {
    return GlobalErrorTaxonomy.VALIDATION.FIELD_FORMAT_INVALID;
  }
  return GlobalErrorTaxonomy.VALIDATION.FAILED;
}

function constraintKeyToCode(constraintKey: string, message: string): string {
  switch (constraintKey) {
    case "isNotEmpty":
    case "isDefined":
    case "isNotEmptyObject":
    case "arrayNotEmpty":
    case "isArray":
      return GlobalErrorTaxonomy.VALIDATION.REQUIRED_FIELD_MISSING;
    case "isEnum":
      return GlobalErrorTaxonomy.VALIDATION.ENUM_INVALID;
    case "whitelistValidation":
    case "forbidNonWhitelisted":
      return "VALIDATION_UNKNOWN_FIELD";
    case "isEmail":
    case "isPhoneNumber":
    case "isUUID":
    case "isInt":
    case "isNumber":
    case "isString":
    case "isBoolean":
    case "isDate":
    case "matches":
    case "minLength":
    case "maxLength":
    case "min":
    case "max":
    case "isUrl":
      return GlobalErrorTaxonomy.VALIDATION.FIELD_FORMAT_INVALID;
    default:
      return inferCodeFromValidationMessage(message);
  }
}
