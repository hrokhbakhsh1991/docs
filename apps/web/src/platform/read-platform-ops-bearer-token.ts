function readPlatformOpsBearerToken(): string {
  return process.env.PLATFORM_OPS_BEARER_TOKEN?.trim() || "platform-ops";
}

export { readPlatformOpsBearerToken };
