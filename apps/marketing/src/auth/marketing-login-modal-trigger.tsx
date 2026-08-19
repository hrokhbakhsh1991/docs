"use client";

import {
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

import {
  useMarketingLoginModalOptional,
  type OpenMarketingLoginModalOptions,
} from "./marketing-login-modal";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  readonly href: string;
  readonly children: ReactNode;
  readonly host?: OpenMarketingLoginModalOptions["host"];
  readonly tourId?: string;
  readonly tourTitle?: string;
};

/**
 * Guest sign-in control for **PDP** (and a future marketing login host).
 * Opens the marketing OTP modal when the provider is mounted so the guest
 * stays on `/tours/{id}`. `href` is no-JS / no-provider only. Header chrome
 * must not use this — it navigates to Portal `/login` (PCMS-MKT-AUTH-05).
 *
 * `data-marketing-register-ready="true"` means onClick is hydrated and the
 * provider is present — Playwright must wait for this or the href navigates
 * to portal (SMK-MKT-03).
 */
export function MarketingLoginModalTrigger({
  href,
  children,
  host = "pdp",
  tourId,
  tourTitle,
  onClick,
  ...rest
}: Props) {
  const modal = useMarketingLoginModalOptional();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    onClick?.(event);
    if (event.defaultPrevented) {
      return;
    }
    if (modal === null) {
      return;
    }
    event.preventDefault();
    modal.openLoginModal({ host, tourId, tourTitle });
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      {...rest}
      data-marketing-register-modal=""
      data-marketing-register-ready={ready && modal !== null ? "true" : "false"}
    >
      {children}
    </a>
  );
}
