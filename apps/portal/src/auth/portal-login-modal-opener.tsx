"use client";

import { useEffect, useRef } from "react";

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
};

/** Opens the shared login modal once (login thin host or register ?auth=login). */
export function PortalLoginModalOpener({ host, portalReturn, flow, autoOpen = true }: Props) {
  const { openLoginModal } = usePortalLoginModal();
  const openedRef = useRef(false);

  useEffect(() => {
    if (!autoOpen || openedRef.current) {
      return;
    }
    openedRef.current = true;
    openLoginModal({ host, portalReturn, flow });
  }, [autoOpen, flow, host, openLoginModal, portalReturn]);

  return null;
}
