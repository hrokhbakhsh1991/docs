"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import {
  usePortalLoginModal,
  type PortalLoginModalFlowInput,
} from "@/auth/portal-login-modal";

type Props = {
  readonly portalReturn?: string;
  readonly flow: PortalLoginModalFlowInput;
  readonly autoOpen?: boolean;
  readonly showTrigger?: boolean;
};

/** Opens the register-route login modal once (PCMS-UX-MODAL-04). `/login` is page OTP (DL-48). */
export function PortalLoginModalOpener({
  portalReturn,
  flow,
  autoOpen = true,
  showTrigger = false,
}: Props) {
  const { openLoginModal } = usePortalLoginModal();
  const t = useTranslations("catalogRegistration.phone");
  const openedRef = useRef(false);

  useEffect(() => {
    if (!autoOpen || openedRef.current) {
      return;
    }
    openedRef.current = true;
    openLoginModal({ portalReturn, flow });
  }, [autoOpen, flow, openLoginModal, portalReturn]);

  if (!showTrigger) {
    return null;
  }

  return (
    <button
      type="button"
      data-portal-login-host-trigger
      onClick={() => openLoginModal({ portalReturn, flow })}
    >
      {t("sendCode")}
    </button>
  );
}
