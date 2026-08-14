"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

export type MarketingRegistrationDialogProviderProps = {
  readonly children: ReactNode;
};

const BOOTSTRAP_SCRIPT = `
(() => {
  if (window.__marketingRegistrationDialogBootstrapped === true) return;
  window.__marketingRegistrationDialogBootstrapped = true;

  const dialog = document.querySelector("[data-marketing-registration-dialog]");
  if (!(dialog instanceof HTMLDialogElement)) return;

  const title = dialog.querySelector("#marketing-registration-dialog-title");
  const frame = dialog.querySelector("[data-marketing-registration-dialog-frame]");
  const loading = dialog.querySelector("[data-marketing-registration-dialog-loading]");
  const closeButton = dialog.querySelector("[data-marketing-registration-dialog-close]");
  const defaultTitle = dialog.getAttribute("data-marketing-registration-dialog-default-title") ?? "";

  if (!(title instanceof HTMLElement) || !(frame instanceof HTMLIFrameElement)) return;

  const setOpenState = (open) => {
    dialog.setAttribute("data-marketing-registration-dialog-open", open ? "true" : "false");
    if (open) {
      dialog.removeAttribute("inert");
    } else {
      dialog.setAttribute("inert", "");
    }
  };

  const closeDialog = () => {
    frame.setAttribute("src", "about:blank");
    title.textContent = defaultTitle;
    if (loading instanceof HTMLElement) {
      loading.hidden = true;
    }
    setOpenState(false);
    if (dialog.open) {
      dialog.close();
    }
  };

  const openDialog = (src, nextTitle) => {
    if (typeof src !== "string" || src.trim().length === 0) return;
    title.textContent =
      typeof nextTitle === "string" && nextTitle.trim().length > 0 ? nextTitle : defaultTitle;
    if (loading instanceof HTMLElement) {
      loading.hidden = false;
    }
    frame.setAttribute("src", src);
    setOpenState(true);
    if (!dialog.open) {
      dialog.showModal();
    }
  };

  document.addEventListener(
    "click",
    (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const trigger = target.closest("[data-marketing-dialog-src]");
      if (!(trigger instanceof HTMLAnchorElement)) return;
      const src = trigger.getAttribute("data-marketing-dialog-src");
      if (src === null || src.trim().length === 0) return;
      event.preventDefault();
      openDialog(src, trigger.getAttribute("data-marketing-dialog-title") ?? "");
    },
    true
  );

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeDialog();
  });
  dialog.addEventListener("close", closeDialog);
  if (closeButton instanceof HTMLButtonElement) {
    closeButton.addEventListener("click", closeDialog);
  }
  frame.addEventListener("load", () => {
    if (loading instanceof HTMLElement) {
      loading.hidden = true;
    }
  });
  dialog.setAttribute("data-marketing-registration-dialog-ready", "true");
})();
`;

export function MarketingRegistrationDialogProvider({
  children,
}: MarketingRegistrationDialogProviderProps) {
  const t = useTranslations("catalog.detail.registrationDialog");

  return (
    <>
      {children}
      <dialog
        data-marketing-registration-dialog=""
        data-marketing-registration-dialog-open="false"
        data-marketing-registration-dialog-ready="false"
        data-marketing-registration-dialog-default-title={t("defaultTitle")}
        aria-labelledby="marketing-registration-dialog-title"
        inert
      >
        <div data-marketing-registration-dialog-panel>
          <header data-marketing-registration-dialog-header>
            <h2 id="marketing-registration-dialog-title">{t("defaultTitle")}</h2>
            <button
              type="button"
              data-marketing-registration-dialog-close
              aria-label={t("close")}
            >
              ×
            </button>
          </header>
          <div data-marketing-registration-dialog-body>
            <p data-marketing-registration-dialog-loading role="status">
              {t("loading")}
            </p>
            <iframe
              src="about:blank"
              title={t("defaultTitle")}
              data-marketing-registration-dialog-frame
            />
          </div>
        </div>
      </dialog>
      <script dangerouslySetInnerHTML={{ __html: BOOTSTRAP_SCRIPT }} />
    </>
  );
}
