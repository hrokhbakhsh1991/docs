/**
 * P1-N-041: Read platform root domain from environment.
 * Used for building club site URLs.
 */
export function readPlatformRootDomain(): string {
  const domain = process.env.PLATFORM_ROOT_DOMAIN?.trim();
  if (!domain) {
    throw new Error("PLATFORM_ROOT_DOMAIN environment variable is required");
  }
  return domain;
}

// Made with Bob
