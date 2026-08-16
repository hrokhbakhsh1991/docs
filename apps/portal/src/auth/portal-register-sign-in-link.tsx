"use client";

import { useTranslations } from "next-intl";

import {
  usePortalLoginModal,
  type PortalLoginModalFlowInput,
} from "@/auth/portal-login-modal";

type Props = {
  readonly flow: PortalLoginModalFlowInput;
};

export function PortalRegisterSignInLink({ flow }: Props) {
  const t = useTranslations("catalogRegistration");
  const { openLoginModal } = usePortalLoginModal();

  return (
    <p data-portal-register-sign-in-link>
      <button
        type="button"
        data-portal-register-sign-in-button
        onClick={() => {
          openLoginModal({ flow });
        }}
      >
        {t("signInToRegister")}
      </button>
    </p>
  );
}
