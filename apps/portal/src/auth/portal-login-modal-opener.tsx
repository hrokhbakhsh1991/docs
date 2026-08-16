"use client";

import { useEffect, useRef } from "react";

import {
  usePortalLoginModal,
  type PortalLoginModalFlowInput,
} from "@/auth/portal-login-modal";

type Props = {
  readonly portalReturn?: string;
  readonly flow: PortalLoginModalFlowInput;
  readonly autoOpen?: boolean;
};

/** Opens the register-route login modal once (PCMS-UX-MODAL-04). `/login` is page OTP (DL-48). */
export function PortalLoginModalOpener({
  portalReturn,
  flow,
  autoOpen = true,
}: Props) {
  const { openLoginModal } = usePortalLoginModal();
  const openedRef = useRef(false);

  useEffect(() => {
    if (!autoOpen || openedRef.current) {
      return;
    }
    openedRef.current = true;
    openLoginModal({ portalReturn, flow });
  }, [autoOpen, flow, openLoginModal, portalReturn]);

  return null;
}
