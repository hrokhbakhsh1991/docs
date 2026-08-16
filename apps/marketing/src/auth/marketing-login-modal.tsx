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

import { tryCreatePortalOriginGuestAuthTransport } from "@app-tour/catalog-registration-flow-ui";

import { isMarketingTourDetailPathname } from "./is-marketing-tour-detail-pathname";
import {
  MarketingLoginAuthFlow,
  type MarketingLoginAuthFlowInput,
} from "./marketing-login-auth-flow";

/** `pdp` is the only wired host. `header` is reserved for a future marketing login surface. */
export type MarketingLoginModalHost = "header" | "pdp";
export { isMarketingTourDetailPathname } from "./is-marketing-tour-detail-pathname";

export type OpenMarketingLoginModalOptions = {
  readonly host?: MarketingLoginModalHost;
  readonly tourId?: string;
  readonly tourTitle?: string;
};

type MarketingLoginModalContextValue = {
  readonly open: boolean;
  readonly canHostAuth: boolean;
  readonly openLoginModal: (options?: OpenMarketingLoginModalOptions) => void;
  readonly closeLoginModal: () => void;
};

const MarketingLoginModalContext = createContext<MarketingLoginModalContextValue | null>(null);

const DESKTOP_MQ = "(min-width: 48rem)";

function resolvePresentation(): "dialog" | "sheet" {
  if (typeof window === "undefined") {
    return "dialog";
  }
  return window.matchMedia(DESKTOP_MQ).matches ? "dialog" : "sheet";
}

export function useMarketingLoginModal(): MarketingLoginModalContextValue {
  const value = useContext(MarketingLoginModalContext);
  if (value === null) {
    throw new Error("useMarketingLoginModal must be used within MarketingLoginModalProvider");
  }
  return value;
}

export function useMarketingLoginModalOptional(): MarketingLoginModalContextValue | null {
  return useContext(MarketingLoginModalContext);
}

export type MarketingLoginModalProviderProps = {
  readonly portalPublicBaseUrl: string | null;
  readonly pluginId: string;
  readonly tenantId: string;
  readonly defaultTourId: string;
  readonly defaultTourTitle: string;
  readonly backHref: string;
  readonly memberModuleHref: string | null;
  readonly children: ReactNode;
};

export function MarketingLoginModalProvider({
  portalPublicBaseUrl,
  pluginId,
  tenantId,
  defaultTourId,
  defaultTourTitle,
  backHref,
  memberModuleHref,
  children,
}: MarketingLoginModalProviderProps) {
  const t = useTranslations("catalogRegistration");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const autoOpenedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<MarketingLoginModalHost>("pdp");
  const [flow, setFlow] = useState<MarketingLoginAuthFlowInput | null>(null);
  const [presentation, setPresentation] = useState<"dialog" | "sheet">("dialog");

  const transport = useMemo(
    () => tryCreatePortalOriginGuestAuthTransport(portalPublicBaseUrl),
    [portalPublicBaseUrl]
  );
  const canHostAuth = transport !== null;

  const closeLoginModal = useCallback(() => {
    setOpen(false);
    setFlow(null);
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    }
  }, []);

  const buildFlow = useCallback(
    (options?: OpenMarketingLoginModalOptions): MarketingLoginAuthFlowInput => ({
      pluginId,
      tenantId,
      tourId: options?.tourId?.trim() || defaultTourId,
      tourTitle: options?.tourTitle?.trim() || defaultTourTitle,
      backHref,
      memberModuleHref,
    }),
    [backHref, defaultTourId, defaultTourTitle, memberModuleHref, pluginId, tenantId]
  );

  const openLoginModal = useCallback(
    (options?: OpenMarketingLoginModalOptions) => {
      setHost(options?.host ?? "pdp");
      setFlow(buildFlow(options));
      setPresentation(resolvePresentation());
      setOpen(true);
    },
    [buildFlow]
  );

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

  useEffect(() => {
    if (autoOpenedRef.current || typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("auth") !== "login") {
      return;
    }
    if (!isMarketingTourDetailPathname(window.location.pathname)) {
      return;
    }
    autoOpenedRef.current = true;
    openLoginModal({ host: "pdp" });
  }, [openLoginModal]);

  const onAuthenticated = useCallback(async () => {
    const url = new URL(window.location.href);
    url.searchParams.delete("auth");
    window.location.assign(`${url.pathname}${url.search}${url.hash}`);
  }, []);

  const value = useMemo(
    (): MarketingLoginModalContextValue => ({
      open,
      canHostAuth,
      openLoginModal,
      closeLoginModal,
    }),
    [canHostAuth, closeLoginModal, open, openLoginModal]
  );

  const titleId = "marketing-login-modal-title";

  return (
    <MarketingLoginModalContext.Provider value={value}>
      {children}
      <dialog
        ref={dialogRef}
        data-marketing-login-modal=""
        data-marketing-login-modal-open={open ? "true" : "false"}
        data-marketing-login-modal-presentation={presentation}
        data-marketing-login-modal-host={host}
        aria-labelledby={open ? titleId : undefined}
        inert={!open}
        onCancel={(event) => {
          event.preventDefault();
          closeLoginModal();
        }}
        onClose={closeLoginModal}
      >
        {open ? (
          <div data-marketing-login-modal-panel>
            <header data-marketing-login-modal-header>
              <h2 id={titleId}>{t("loginPageTitle")}</h2>
              <button
                type="button"
                data-marketing-login-modal-close
                aria-label={t("loginModalClose")}
                onClick={closeLoginModal}
              >
                ×
              </button>
            </header>
            {flow !== null && transport !== null ? (
              <div data-marketing-login-modal-body data-member-login-egress="">
                <div data-marketing-login-modal-intro>
                  <p data-marketing-login-modal-intro-eyebrow>{t("phone.loginTitle")}</p>
                  <p data-marketing-login-modal-intro-lede>{t("phone.loginDescription")}</p>
                  <div data-marketing-login-modal-intro-hints>
                    <p>{t("phone.existingHint")}</p>
                    <p>{t("phone.newHint")}</p>
                  </div>
                </div>
                <MarketingLoginAuthFlow
                  flow={flow}
                  transport={transport}
                  onAuthenticated={onAuthenticated}
                />
              </div>
            ) : (
              <p data-marketing-login-unavailable role="alert">
                {t("errors.BACKEND_UNREACHABLE")}
              </p>
            )}
          </div>
        ) : null}
      </dialog>
    </MarketingLoginModalContext.Provider>
  );
}
