/**
 * Same-origin fetch client for Next.js BFF routes (`/api/*`).
 * Uses session cookie; avoids cross-origin calls to `:3001` from the browser.
 */

import {
  ApiError,
  ForbiddenError,
  NotFoundError,
  type ApiRequestOptions,
} from "@/lib/api-client";

function extractMessage(status: number, data: unknown): string {
  if (data && typeof data === "object") {
    const envelope = data as { error?: { message?: string }; message?: unknown };
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
  const envelope = data as { error?: { code?: unknown }; code?: unknown };
  if (typeof envelope.error?.code === "string" && envelope.error.code.trim()) {
    return envelope.error.code.trim();
  }
  if (typeof envelope.code === "string" && envelope.code.trim()) {
    return envelope.code.trim();
  }
  return undefined;
}

function toApiError(status: number, data: unknown, options?: ApiRequestOptions): ApiError {
  const backendCode = extractBackendCode(data);
  if (status === 401) {
    const code = backendCode ?? "UNAUTHORIZED";
    if (code === "AUTH_TOKEN_REVOKED" || code === "AUTH_UNAUTHENTICATED") {
      return new ApiError(code, "Your session has expired. Please sign in again.", status, data);
    }
    return new ApiError(code, extractMessage(status, data), status, data);
  }
  if (status === 403) {
    if (options?.skip403Redirect) {
      return new ApiError(backendCode ?? "FORBIDDEN", extractMessage(status, data), status, data);
    }
    return new ForbiddenError(extractMessage(status, data), data);
  }
  if (status === 404) {
    return new NotFoundError(extractMessage(status, data), backendCode ?? "RESOURCE_NOT_FOUND", data);
  }
  if (status === 500) {
    return new ApiError(backendCode ?? "SERVER_ERROR", "Server error. Please try again later.", status, data);
  }
  return new ApiError(backendCode ?? "REQUEST_FAILED", extractMessage(status, data), status, data);
}

async function parseJsonResponse<T>(
  res: Response,
  options?: ApiRequestOptions,
): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw toApiError(res.status, data, options);
  }
  return data as T;
}

function buildHeaders(options?: ApiRequestOptions, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const idem = options?.idempotencyKey;
  if (idem === true && typeof crypto !== "undefined" && crypto.randomUUID) {
    headers.set("Idempotency-Key", crypto.randomUUID());
  } else if (typeof idem === "string" && idem.trim()) {
    headers.set("Idempotency-Key", idem.trim());
  }
  return headers;
}

function buildFetchInit(
  init: RequestInit,
  options?: ApiRequestOptions,
): RequestInit {
  return {
    ...init,
    credentials: init.credentials ?? "include",
    cache: init.cache ?? "no-store",
    signal: options?.signal ?? init.signal,
  };
}

export const bffBrowserClient = {
  async get<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    const res = await fetch(
      path,
      buildFetchInit({ credentials: "include", cache: "no-store" }, options),
    );
    return parseJsonResponse<T>(res, options);
  },

  async post<T>(path: string, body: unknown, options?: ApiRequestOptions): Promise<T> {
    const res = await fetch(
      path,
      buildFetchInit(
        {
          method: "POST",
          headers: buildHeaders(options),
          body: JSON.stringify(body),
        },
        options,
      ),
    );
    return parseJsonResponse<T>(res, options);
  },

  async postForm<T>(path: string, formData: FormData, options?: ApiRequestOptions): Promise<T> {
    const headers = new Headers();
    const idem = options?.idempotencyKey;
    if (idem === true && typeof crypto !== "undefined" && crypto.randomUUID) {
      headers.set("Idempotency-Key", crypto.randomUUID());
    } else if (typeof idem === "string" && idem.trim()) {
      headers.set("Idempotency-Key", idem.trim());
    }
    const res = await fetch(
      path,
      buildFetchInit(
        {
          method: "POST",
          headers,
          body: formData,
        },
        options,
      ),
    );
    return parseJsonResponse<T>(res, options);
  },

  async patch<T>(path: string, body: unknown, options?: ApiRequestOptions): Promise<T> {
    const res = await fetch(
      path,
      buildFetchInit(
        {
          method: "PATCH",
          headers: buildHeaders(options),
          body: JSON.stringify(body),
        },
        options,
      ),
    );
    return parseJsonResponse<T>(res, options);
  },

  async delete<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    const res = await fetch(
      path,
      buildFetchInit(
        {
          method: "DELETE",
          headers: buildHeaders(options),
        },
        options,
      ),
    );
    return parseJsonResponse<T>(res, options);
  },

  async getBlob(path: string, options?: ApiRequestOptions): Promise<Blob> {
    const res = await fetch(
      path,
      buildFetchInit({ headers: buildHeaders(options) }, options),
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw toApiError(res.status, data, options);
    }
    return res.blob();
  },
};
