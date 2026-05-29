import { vi } from "vitest";

import { handleAuthFetchRequest, type AuthFetchHandlerOptions } from "./auth-fetch-handler";

export type AuthFetchMockSessionType = import("./auth-fetch-handler").AuthFetchMockSessionType;
export type InstallAuthFetchMockOptions = AuthFetchHandlerOptions;

export function installAuthFetchMock(
  options: InstallAuthFetchMockOptions = {},
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
    handleAuthFetchRequest(input, init, options),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function resetAuthTestStorage(): void {
  sessionStorage.clear();
  localStorage.clear();
}
