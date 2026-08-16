"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import {
  usePortalLoginModal,
  type PortalLoginModalFlowInput,
} from "@/auth/portal-login-modal";

type Props = {
  readonly flow: PortalLoginModalFlowInput;
  readonly portalReturn: string;
};

/**
 * Phase 2 thin `/login` host — auto-opens the shared modal and keeps a reopen
 * panel after dismiss. OTP lives in the modal, not on this page.
 */
export function PortalLoginThinHost({ flow, portalReturn }: Props) {
  const t = useTranslations("catalogRegistration");
  const { open, openLoginModal } = usePortalLoginModal();
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) {
      return;
    }
    openedRef.current = true;
    openLoginModal({ host: "login", portalReturn, flow });
  }, [flow, openLoginModal, portalReturn]);

  return (
    <div
      data-portal-login-host-lede=""
      data-portal-login-host-lede-modal-open={open ? "true" : "false"}
    >
      <div data-portal-login-host-panel>
        <div data-portal-login-host-copy>
          <p data-portal-login-host-eyebrow>{t("phone.formEyebrow")}</p>
          <h2 data-portal-login-host-title>{t("phone.portalStoryTitle")}</h2>
          <p data-portal-login-host-description>{t("phone.portalStoryDescription")}</p>
        </div>
        <p data-portal-login-host-intent>{t("phone.loginPrompt")}</p>
        <ul data-portal-login-host-points>
          <li>{t("phone.existingHint")}</li>
          <li>{t("phone.newHint")}</li>
          <li>{t("phone.portalAssurance")}</li>
        </ul>
        <div data-portal-login-host-action-shell>
          <button
            type="button"
            data-portal-login-host-trigger
            onClick={() => openLoginModal({ host: "login", portalReturn, flow })}
          >
            {t("loginPageTitle")}
          </button>
          <p data-portal-login-host-action-note>{t("phone.loginActionHint")}</p>
        </div>
      </div>
    </div>
  );
}
