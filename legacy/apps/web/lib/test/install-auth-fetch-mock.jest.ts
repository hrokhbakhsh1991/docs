import { handleAuthFetchRequest, type AuthFetchHandlerOptions } from "./auth-fetch-handler";

export type AuthFetchMockSessionType = import("./auth-fetch-handler").AuthFetchMockSessionType;
export type InstallAuthFetchMockOptions = AuthFetchHandlerOptions;

export function installAuthFetchMock(
  options: InstallAuthFetchMockOptions = {},
): jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]> {
  const fetchMock = jest.fn((input: RequestInfo | URL, init?: RequestInit) =>
    handleAuthFetchRequest(input, init, options),
  );
  global.fetch = fetchMock as typeof fetch;
  return fetchMock;
}

export function resetAuthTestStorage(): void {
  sessionStorage.clear();
  localStorage.clear();
}
