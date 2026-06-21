const DEFAULT_DEV_BEARER = "platform-ops";

export function readPlatformOpsBearerToken(input?: string): string {
  const fromEnv = input ?? process.env.PLATFORM_OPS_BEARER_TOKEN?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  return DEFAULT_DEV_BEARER;
}
