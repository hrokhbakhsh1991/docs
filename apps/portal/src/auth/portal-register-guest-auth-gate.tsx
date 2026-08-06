"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import {
  usePortalLoginModal,
  type PortalLoginModalFlowInput,
} from "@/auth/portal-login-modal";
import { PortalRegisterSignInLink } from "@/auth/portal-register-sign-in-link";

type Props = {
  readonly flow: PortalLoginModalFlowInput;
  readonly tenantId: string;
};

/**
 * PCMS-UX-MODAL-04 — guest register host: no inline OTP; reopen control +
 * client session probe when SSR missed the cookie (custom apex).
 */
export function PortalRegisterGuestAuthGate({ flow, tenantId }: Props) {
  const t = useTranslations("catalogRegistration");
  const { open } = usePortalLoginModal();
  const probedRef = useRef(false);

  useEffect(() => {
    if (probedRef.current) {
      return;
    }
    probedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/me/profile", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok || cancelled) {
          return;
        }
        const body = (await res.json()) as { ok?: boolean; profile?: { tenantId?: string } };
        if (body.ok === true && body.profile?.tenantId === tenantId) {
          window.location.reload();
        }
      } catch {
        // stay on auth gate
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return (
    <div
      data-portal-register-auth-gate=""
      data-portal-register-auth-gate-modal-open={open ? "true" : "false"}
    >
      <p data-portal-register-auth-gate-lede>{t("phone.loginDescription")}</p>
      <PortalRegisterSignInLink flow={flow} />
    </div>
  );
}
