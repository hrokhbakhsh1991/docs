"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import {
  usePortalLoginModal,
  type PortalLoginModalFlowInput,
  type PortalLoginModalHost,
} from "@/auth/portal-login-modal";

type Props = {
  readonly host: PortalLoginModalHost;
  readonly portalReturn?: string;
  readonly flow: PortalLoginModalFlowInput;
  readonly autoOpen?: boolean;
  readonly showTrigger?: boolean;
};

/** Opens the shared login modal once (login thin host or register ?auth=login). */
export function PortalLoginModalOpener({
  host,
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
    openLoginModal({ host, portalReturn, flow });
  }, [autoOpen, flow, host, openLoginModal, portalReturn]);

  if (!showTrigger) {
    return null;
  }

  return (
    <button
      type="button"
      data-portal-login-host-trigger
      onClick={() => openLoginModal({ host, portalReturn, flow })}
    >
      {t("sendCode")}
    </button>
  );
}
