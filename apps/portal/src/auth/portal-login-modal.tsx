"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";

import { completeMemberLoginEgress } from "@app-tour/catalog-registration-flow-ui";

import { PublicCatalogRegistrationFlow } from "@/catalog/public-catalog-registration-flow";

export type PortalLoginModalHost = "login" | "register";

export type PortalLoginModalFlowInput = {
  readonly workspace: string;
  readonly tenantId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly backHref: string;
  readonly memberModuleHref: string | null;
};

export type OpenPortalLoginModalOptions = {
  readonly host: PortalLoginModalHost;
  readonly portalReturn?: string;
  readonly flow: PortalLoginModalFlowInput;
};

type PortalLoginModalContextValue = {
  readonly open: boolean;
  readonly openLoginModal: (options: OpenPortalLoginModalOptions) => void;
  readonly closeLoginModal: () => void;
};

const PortalLoginModalContext = createContext<PortalLoginModalContextValue | null>(null);

const DESKTOP_MQ = "(min-width: 48rem)";

function resolvePresentation(): "dialog" | "sheet" {
  if (typeof window === "undefined") {
    return "dialog";
  }
  return window.matchMedia(DESKTOP_MQ).matches ? "dialog" : "sheet";
}

export function usePortalLoginModal(): PortalLoginModalContextValue {
  const value = useContext(PortalLoginModalContext);
  if (value === null) {
    throw new Error("usePortalLoginModal must be used within PortalLoginModalProvider");
  }
  return value;
}

export function usePortalLoginModalOptional(): PortalLoginModalContextValue | null {
  return useContext(PortalLoginModalContext);
}

type ProviderProps = {
  readonly children: ReactNode;
};

export function PortalLoginModalProvider({ children }: ProviderProps) {
  const t = useTranslations("catalogRegistration");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<PortalLoginModalHost>("login");
  const [portalReturn, setPortalReturn] = useState<string | undefined>(undefined);
  const [flow, setFlow] = useState<PortalLoginModalFlowInput | null>(null);
  const [presentation, setPresentation] = useState<"dialog" | "sheet">("dialog");

  const closeLoginModal = useCallback(() => {
    setOpen(false);
    setFlow(null);
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    }
  }, []);

  const openLoginModal = useCallback((options: OpenPortalLoginModalOptions) => {
    setHost(options.host);
    setPortalReturn(options.portalReturn);
    setFlow(options.flow);
    setPresentation(resolvePresentation());
    setOpen(true);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const sync = () => {
      if (open) {
        setPresentation(mq.matches ? "dialog" : "sheet");
      }
    };
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [open]);

  const onRegisterSessionReady = useCallback(async () => {
    closeLoginModal();
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    window.location.assign(`${url.pathname}${url.search}`);
  }, [closeLoginModal]);

  const onLoginSessionReady = useCallback(() => {
    completeMemberLoginEgress({ memberLoginEgress: true });
  }, []);

  const value = useMemo(
    (): PortalLoginModalContextValue => ({
      open,
      openLoginModal,
      closeLoginModal,
    }),
    [open, openLoginModal, closeLoginModal]
  );

  const titleId = "portal-login-modal-title";
  const modalTitle = host === "register" ? t("signInToRegister") : t("loginPageTitle");
  const modalLede =
    host === "register" ? t("phone.existingMemberDescription") : t("phone.loginDescription");
  const showRegisterIntro = host === "login";

  return (
    <PortalLoginModalContext.Provider value={value}>
      {children}
      <dialog
        ref={dialogRef}
        data-portal-login-modal=""
        data-portal-login-modal-open={open ? "true" : "false"}
        data-portal-login-modal-presentation={presentation}
        data-portal-login-modal-host={host}
        {...(portalReturn !== undefined ? { "data-portal-return": portalReturn } : {})}
        aria-labelledby={open ? titleId : undefined}
        inert={!open}
        onCancel={(event) => {
          event.preventDefault();
          closeLoginModal();
        }}
        onClose={closeLoginModal}
      >
        {open ? (
          <div data-portal-login-modal-panel>
            <header data-portal-login-modal-header>
              <h2 id={titleId}>{modalTitle}</h2>
              <button
                type="button"
                data-portal-login-modal-close
                aria-label={t("loginModalClose")}
                onClick={closeLoginModal}
              >
                ×
              </button>
            </header>
            {flow !== null ? (
              <div
                data-portal-login-modal-body
                data-member-login-egress=""
                data-portal-login-modal-body-variant={host}
              >
                {showRegisterIntro ? (
                  <div data-portal-login-modal-intro>
                    <p data-portal-login-modal-intro-eyebrow>{t("phone.loginTitle")}</p>
                    <p data-portal-login-modal-intro-lede>{modalLede}</p>
                    <div data-portal-login-modal-intro-hints>
                      <p>{t("phone.existingHint")}</p>
                      <p>{t("phone.newHint")}</p>
                    </div>
                  </div>
                ) : null}
                <PublicCatalogRegistrationFlow
                  workspace={flow.workspace}
                  tenantId={flow.tenantId}
                  tourId={flow.tourId}
                  tourTitle={flow.tourTitle}
                  tourPoliciesText={null}
                  tourPriceAmount={null}
                  tourNationalIdRequired={false}
                  tourFatherNameRequired={false}
                  tourBirthDateRequired={false}
                  backHref={flow.backHref}
                  memberModuleHref={flow.memberModuleHref}
                  memberLoginEgress
                  memberLoginStayOnPage={host === "register"}
                  onAuthenticated={
                    host === "register" ? onRegisterSessionReady : onLoginSessionReady
                  }
                  onMemberLoginSessionReady={
                    host === "register" ? onRegisterSessionReady : undefined
                  }
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </PortalLoginModalContext.Provider>
  );
}
