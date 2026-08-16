"use client";

import { type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";

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
 * Opens the marketing OTP modal when the Portal-origin transport exists;
 * otherwise navigates to the GSH portal href. Header chrome must not use this
 * — it navigates to Portal `/login` (PCMS-MKT-AUTH-05).
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

  function handleClick(event: MouseEvent<HTMLAnchorElement>): void {
    onClick?.(event);
    if (event.defaultPrevented) {
      return;
    }
    if (modal === null || !modal.canHostAuth) {
      return;
    }
    event.preventDefault();
    modal.openLoginModal({ host, tourId, tourTitle });
  }

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
