/** Dispatched on `window` when the API client needs a toast outside React (axios interceptor). */
export const GLOBAL_API_TOAST_EVENT = "tour-ops:global-api-toast";

export type GlobalApiToastDetail = {
  message: string;
  type?: "error" | "info" | "warning" | "success";
};

let lastToastKey = "";
let lastToastAt = 0;
const TOAST_DEDUPE_WINDOW_MS = 1500;

export function emitGlobalApiToast(detail: GlobalApiToastDetail): void {
  if (typeof window === "undefined") return;
  const message = detail.message.trim();
  if (!message) return;
  const type = detail.type ?? "error";
  const now = Date.now();
  const key = `${type}:${message}`;
  if (lastToastKey === key && now - lastToastAt < TOAST_DEDUPE_WINDOW_MS) {
    return;
  }
  lastToastKey = key;
  lastToastAt = now;
  window.dispatchEvent(new CustomEvent(GLOBAL_API_TOAST_EVENT, { detail: { ...detail, message, type } }));
}
