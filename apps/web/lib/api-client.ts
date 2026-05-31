/**
 * Axios HTTP client for Tour-Ops API (see `resolveTourOpsApiBaseUrl` / `tour-ops-api-origin.ts`).
 *
 * Auth transport (browser → Nest):
 * - The HttpOnly `session` cookie is scoped to the **Next.js origin** (`:3000`) only — it is **not**
 *   sent to Nest on another port (`:3001`) even with `withCredentials: true`.
 * - **Source of truth for Nest:** scoped `localStorage` mirror (`tour_ops_session_token:{scope}` in
 *   `lib/auth/session.ts`), written on login, workspace switch, and hydrate.
 * - The request interceptor attaches `Authorization: Bearer <token>` from `getStoredSessionToken()`.
 * - Same-origin BFF routes (`/api/*`) use the cookie via `bffBrowserFetch` + `credentials: "include"`.
 * - Route protection in `middleware.ts` relies on the HttpOnly cookie only.
 *
 * Clears session and redirects on 401 (except login flows).
 */

import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponseHeaders,
  type RawAxiosResponseHeaders,
} from "axios";

import { clearAuthAndRedirectToLogin } from "./auth/session";
import { getStoredSessionToken } from "./auth/session";
import { emitGlobalApiToast } from "./global-api-toast";
import { resolveTourOpsApiBaseUrl } from "./tour-ops-api-origin";

export { normalizeTourOpsApiOrigin } from "./tour-ops-api-origin";

declare module "axios" {
  export interface AxiosRequestConfig {
  /**
   * @deprecated Prefer explicit UX via {@link getUIError} / auth context. When false (default), 401 does not navigate away.
   */
  skipAuthRedirectOn401?: boolean;
  /** Opt-in: clear session and redirect to login on 401 (legacy axios client only). */
  redirectOn401?: boolean;
  /** Do not full-page redirect to `/403` on 403 (caller handles inline) */
  skip403Redirect?: boolean;
  /** Opt-in: navigate to `/403` on forbidden responses. */
  redirectOn403?: boolean;
    /** Request interceptor sets Idempotency-Key when true */
    attachIdempotency?: boolean;
    /** Skip global interceptor toasts (500 / connection) for this request */
    skipGlobalErrorToast?: boolean;
  }
}

const API_TIMEOUT_MS = 15_000;

function assertNoDoubleApiV2InUrl(resolvedUrl: string): void {
  if (resolvedUrl.includes("/api/v2/api/v2")) {
    throw new Error("Invalid API path: double /api/v2 detected");
  }
}

export class ApiError extends Error {
  code: string;

  status?: number;

  data?: unknown;

  /** Correlates with API `requestId` / `x-request-id` for support and logging. */
  requestId?: string;

  constructor(
    code: string,
    message: string,
    status?: number,
    data?: unknown,
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.data = data;
    this.requestId = requestId;
  }
}

export class ForbiddenError extends ApiError {
  constructor(
    message = "You are not allowed to perform this action.",
    data?: unknown,
    requestId?: string,
  ) {
    super("FORBIDDEN", message, 403, data, requestId);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(
    message: string = "The requested resource was not found.",
    code = "RESOURCE_NOT_FOUND",
    data?: unknown,
    requestId?: string,
  ) {
    super(code, message, 404, data, requestId);
    this.name = "NotFoundError";
  }
}

function extractMessage(status: number, data: unknown): string {
  if (data && typeof data === "object") {
    const envelope = data as {
      error?: { message?: string; code?: string };
      message?: unknown;
    };
    if (typeof envelope.error?.message === "string" && envelope.error.message.trim()) {
      return envelope.error.message;
    }
    if (typeof envelope.message === "string" && envelope.message.trim()) {
      return envelope.message;
    }
  }
  return `Request failed with status ${status}`;
}

function extractBackendCode(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const envelope = data as {
    error?: { code?: unknown };
    code?: unknown;
  };
  if (typeof envelope.error?.code === "string" && envelope.error.code.trim()) {
    return envelope.error.code.trim();
  }
  if (typeof envelope.code === "string" && envelope.code.trim()) {
    return envelope.code.trim();
  }
  return undefined;
}

type ApiResponseHeaders = AxiosResponseHeaders | Partial<RawAxiosResponseHeaders>;

function readHeaderRequestId(headers?: ApiResponseHeaders): string | undefined {
  if (!headers) return undefined;
  const raw =
    typeof headers.get === "function"
      ? headers.get("x-request-id")
      : (headers as Record<string, unknown>)["x-request-id"] ??
        (headers as Record<string, unknown>)["X-Request-Id"];
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) {
    return raw[0].trim();
  }
  return undefined;
}

/** Reads API envelope `requestId` (top-level or `error.details.requestId`) and response header. */
export function extractRequestIdFromResponse(
  data: unknown,
  headers?: ApiResponseHeaders,
): string | undefined {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const envelope = data as {
      requestId?: unknown;
      error?: { details?: { requestId?: unknown } };
    };
    if (typeof envelope.requestId === "string" && envelope.requestId.trim()) {
      return envelope.requestId.trim();
    }
    const detailsId = envelope.error?.details?.requestId;
    if (typeof detailsId === "string" && detailsId.trim()) {
      return detailsId.trim();
    }
  }
  return readHeaderRequestId(headers);
}

function createApiError(
  code: string,
  message: string,
  status?: number,
  data?: unknown,
  headers?: ApiResponseHeaders,
): ApiError {
  return new ApiError(code, message, status, data, extractRequestIdFromResponse(data, headers));
}

function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<unknown>;
    const status = ax.response?.status;
    const data = ax.response?.data;
    const headers = ax.response?.headers;
    const requestUrl = String(ax.config?.url ?? "");
    const errCode = String(ax.code ?? "").toUpperCase();
    const msg = typeof ax.message === "string" ? ax.message.toLowerCase() : "";
    const isTimeout = errCode === "ECONNABORTED" || errCode === "ETIMEDOUT" || msg.includes("timeout");
    if (isTimeout) {
      return createApiError("TIMEOUT", "Request timed out. Please try again.", status, data, headers);
    }
    if (!ax.response) {
      return new ApiError("NETWORK_ERROR", "Connection lost. Please check your network and try again.");
    }
    if (typeof status === "number") {
      const backendCode = extractBackendCode(data);
      const requestId = extractRequestIdFromResponse(data, headers);
      if (status === 401) {
        const code = backendCode ?? "UNAUTHORIZED";
        const isLoginPath = requestUrl.includes("/api/v2/auth/web/session/otp");
        if (code === "AUTH_OTP_INVALID") {
          return new ApiError(code, "Invalid OTP code.", status, data, requestId);
        }
        if (code === "AUTH_OTP_EXPIRED") {
          return new ApiError(code, "OTP has expired. Request a new code and try again.", status, data, requestId);
        }
        if (code === "AUTH_PHONE_INVALID") {
          return new ApiError(code, "Invalid phone number or OTP.", status, data, requestId);
        }
        if (isLoginPath && code === "AUTH_UNAUTHENTICATED") {
          return new ApiError(code, "Invalid phone number or OTP.", status, data, requestId);
        }
        if (code === "AUTH_TOKEN_REVOKED") {
          return new ApiError(code, "Your session has expired. Please sign in again.", status, data, requestId);
        }
        return new ApiError(code, "Your session has expired. Please sign in again.", status, data, requestId);
      }
      if (status === 403) {
        return new ForbiddenError("You are not allowed to perform this action.", data, requestId);
      }
      if (status === 404) {
        const code = backendCode ?? "RESOURCE_NOT_FOUND";
        return new NotFoundError(extractMessage(status, data), code, data, requestId);
      }
      if (status === 500) {
        return createApiError(
          backendCode ?? "SERVER_ERROR",
          "Server error. Please try again later.",
          status,
          data,
          headers,
        );
      }
      return createApiError(
        backendCode ?? "REQUEST_FAILED",
        extractMessage(status, data),
        status,
        data,
        headers,
      );
    }
    return new ApiError("REQUEST_FAILED", "Request failed.");
  }
  if (error instanceof Error) {
    return new ApiError("REQUEST_FAILED", error.message);
  }
  return new ApiError("REQUEST_FAILED", String(error));
}

export type ApiRequestOptions = {
  /** Send Idempotency-Key; use `true` to generate a UUID per request */
  idempotencyKey?: string | boolean;
  /** Set on auth session POST so invalid OTP 401 does not wipe cookies or redirect */
  skipAuthRedirectOn401?: boolean;
  /** When true, 403 responses reject without navigating to `/403` (inline UX) */
  skip403Redirect?: boolean;
  /** Opt out of global 500 / connection-lost toasts for this call */
  skipGlobalErrorToast?: boolean;
  /** Override: use this JWT instead of the token from session storage. */
  authToken?: string;
  /** Abort in-flight request when TanStack Query cancels or workspace switches. */
  signal?: AbortSignal;
};

function mergeRequestConfig(options?: ApiRequestOptions) {
  const headers: Record<string, string> = {};
  if (typeof options?.idempotencyKey === "string") {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }
  if (typeof options?.authToken === "string" && options.authToken.trim()) {
    headers.Authorization = `Bearer ${options.authToken.trim()}`;
  } else {
    const storedToken = getStoredSessionToken();
    if (storedToken) {
      headers.Authorization = `Bearer ${storedToken}`;
    }
  }
  return {
    headers,
    signal: options?.signal,
    attachIdempotency: options?.idempotencyKey === true,
    skipAuthRedirectOn401: options?.skipAuthRedirectOn401,
    skip403Redirect: options?.skip403Redirect,
    skipGlobalErrorToast: options?.skipGlobalErrorToast,
  };
}

export const axiosApi: AxiosInstance = axios.create({
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
  timeout: API_TIMEOUT_MS,
});

axiosApi.interceptors.request.use((config) => {
  const base = resolveTourOpsApiBaseUrl().trim();
  if (!base) {
    return Promise.reject(new Error("Tour-Ops API is not configured (use NEXT_PUBLIC_API_DYNAMIC_ORIGIN=true)."));
  }
  config.baseURL = base;

  assertNoDoubleApiV2InUrl(axios.getUri({ ...config, baseURL: base }));

  const method = (config.method ?? "get").toUpperCase();
  if (
    (method === "POST" || method === "PATCH") &&
    config.attachIdempotency &&
    config.headers["Idempotency-Key"] === undefined
  ) {
    config.headers["Idempotency-Key"] =
      typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  }

  // Cross-origin Nest (`denali.localhost:3001`) does not receive the Next `session` cookie — attach Bearer mirror.
  if (typeof window !== "undefined") {
    const storedToken = getStoredSessionToken();
    if (storedToken) {
      const headers = axios.AxiosHeaders.from(config.headers ?? {});
      if (!headers.get("Authorization")) {
        headers.set("Authorization", `Bearer ${storedToken}`);
      }
      config.headers = headers;
    }
  }

  return config;
});

function isLikelyNetworkOrTimeout(error: AxiosError): boolean {
  if (axios.isCancel(error)) return false;
  if (error.response) return false;
  const code = error.code;
  if (code === "ERR_CANCELED") return false;
  if (code === "ERR_NETWORK" || code === "ECONNABORTED" || code === "ETIMEDOUT") return true;
  const msg = typeof error.message === "string" ? error.message.toLowerCase() : "";
  if (msg.includes("network error") || msg.includes("timeout")) return true;
  return false;
}

axiosApi.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window === "undefined") {
      return Promise.reject(error);
    }

    const cfg = error.config;
    const _status = error.response?.status;

    if (_status === 401 && cfg?.redirectOn401 === true) {
      void clearAuthAndRedirectToLogin();
      return Promise.reject(error);
    }

    if (_status === 403 && cfg?.redirectOn403 === true) {
      const path = window.location.pathname;
      if (path !== "/403") {
        window.location.assign("/403");
      }
      return Promise.reject(error);
    }

    if (!cfg?.skipGlobalErrorToast) {
      if (isLikelyNetworkOrTimeout(error)) {
        emitGlobalApiToast({ type: "error", message: "Connection lost. Please try again." });
      } else if (_status === 500) {
        emitGlobalApiToast({ type: "error", message: "Server error. Please try again later." });
      }
    }

    return Promise.reject(error);
  }
);

export const apiClient = {
  async get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    if (!resolveTourOpsApiBaseUrl().trim()) {
      throw new ApiError("CONFIG_ERROR", "Tour-Ops API is not configured (use NEXT_PUBLIC_API_DYNAMIC_ORIGIN=true).");
    }
    try {
      const res = await axiosApi.get<T>(path, mergeRequestConfig(options));
      return res.data;
    } catch (e) {
      throw toApiError(e);
    }
  },

  async post<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    if (!resolveTourOpsApiBaseUrl().trim()) {
      throw new ApiError("CONFIG_ERROR", "Tour-Ops API is not configured (use NEXT_PUBLIC_API_DYNAMIC_ORIGIN=true).");
    }
    try {
      const res = await axiosApi.post<T>(path, body, mergeRequestConfig(options));
      return res.data;
    } catch (e) {
      throw toApiError(e);
    }
  },

  async patch<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
    if (!resolveTourOpsApiBaseUrl().trim()) {
      throw new ApiError("CONFIG_ERROR", "Tour-Ops API is not configured (use NEXT_PUBLIC_API_DYNAMIC_ORIGIN=true).");
    }
    try {
      const res = await axiosApi.patch<T>(path, body, mergeRequestConfig(options));
      return res.data;
    } catch (e) {
      throw toApiError(e);
    }
  },

  async delete<T = void>(path: string, options?: ApiRequestOptions): Promise<T> {
    if (!resolveTourOpsApiBaseUrl().trim()) {
      throw new ApiError("CONFIG_ERROR", "Tour-Ops API is not configured (use NEXT_PUBLIC_API_DYNAMIC_ORIGIN=true).");
    }
    try {
      const res = await axiosApi.delete<T>(path, mergeRequestConfig(options));
      return res.data as T;
    } catch (e) {
      throw toApiError(e);
    }
  },

  /**
   * Binary GET (CSV export, file downloads). Caller should handle non-JSON error bodies.
   */
  async getBlob(path: string, options?: ApiRequestOptions): Promise<Blob> {
    if (!resolveTourOpsApiBaseUrl().trim()) {
      throw new ApiError("CONFIG_ERROR", "Tour-Ops API is not configured (use NEXT_PUBLIC_API_DYNAMIC_ORIGIN=true).");
    }
    try {
      const res = await axiosApi.get<Blob>(path, {
        ...mergeRequestConfig(options),
        responseType: "blob"
      });
      return res.data;
    } catch (e) {
      throw toApiError(e);
    }
  }
};
