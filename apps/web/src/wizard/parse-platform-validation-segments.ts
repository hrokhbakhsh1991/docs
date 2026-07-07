export type PlatformValidationSegment = {
  readonly path?: string;
  readonly code?: string;
  readonly message: string;
};

export function stripCanonicalValidationFailurePrefix(message: string): string {
  const trimmed = message.trim();
  const prefix = "CANONICAL_VALIDATION_FAILED:";
  if (trimmed.startsWith(prefix)) {
    return trimmed.slice(prefix.length).trim();
  }
  return trimmed;
}

export function splitPlatformValidationSegments(message: string): readonly string[] {
  const body = stripCanonicalValidationFailurePrefix(message);
  if (body.length === 0) {
    return [];
  }
  return body.split(/;\s*/).filter((segment) => segment.trim().length > 0);
}

export function parsePlatformValidationSegment(segment: string): PlatformValidationSegment {
  const trimmed = segment.trim();
  const canonicalPathMatch = trimmed.match(/^Canonical path "([^"]+)"/);
  if (canonicalPathMatch != null) {
    return {
      path: canonicalPathMatch[1],
      code: "CANONICAL_TYPE_MISMATCH",
      message: trimmed,
    };
  }

  const missingValueMatch = trimmed.match(/^No value at canonical path "([^"]+)"/);
  if (missingValueMatch != null) {
    return {
      path: missingValueMatch[1],
      code: "REQUIRED_FIELD_EMPTY",
      message: trimmed,
    };
  }

  const codeMessageMatch = trimmed.match(/^([A-Z0-9_]+):\s*(.+)$/);
  if (codeMessageMatch != null) {
    return {
      code: codeMessageMatch[1],
      message: trimmed,
    };
  }

  return { message: trimmed };
}

export function parsePlatformValidationMessage(message: string): readonly PlatformValidationSegment[] {
  return splitPlatformValidationSegments(message).map(parsePlatformValidationSegment);
}
