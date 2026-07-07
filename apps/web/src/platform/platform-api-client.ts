const PLATFORM_BFF_PREFIX = "/api/platform";

export function platformBffPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${PLATFORM_BFF_PREFIX}${normalized}`;
}

export async function fetchPlatformApi(
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(platformBffPath(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}
