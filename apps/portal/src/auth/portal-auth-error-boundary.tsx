"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

type Props = {
  readonly portalReturn: string;
  readonly children: ReactNode;
};

type State = { readonly failed: boolean };

function PortalAuthFailure({ portalReturn }: { readonly portalReturn: string }) {
  const t = useTranslations("catalogRegistration");
  return (
    <div data-portal-auth-state="error" role="alert">
      <p>{t("phone.loginFallback")}</p>
      <button type="button" onClick={() => window.location.reload()}>
        {t("phone.loginRetry")}
      </button>
      <a href={`/login?portalReturn=${encodeURIComponent(portalReturn)}`}>
        {t("phone.loginRetry")}
      </a>
    </div>
  );
}

export class PortalAuthErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Keep the failure user-visible without exposing raw exception text.
  }

  render() {
    return this.state.failed ? (
      <PortalAuthFailure portalReturn={this.props.portalReturn} />
    ) : (
      this.props.children
    );
  }
}
