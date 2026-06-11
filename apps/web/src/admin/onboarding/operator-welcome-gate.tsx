"use client";

import { useEffect, useState } from "react";

import {
  resolveProfileDisplayName,
  type OperatorProfile,
} from "@/features/settings/profile-settings-logic";

import {
  isOperatorWelcomeArmedForLogin,
  isOperatorWelcomePresentedThisLogin,
  isOperatorWelcomeShownThisLogin,
  markOperatorWelcomePresentedThisLogin,
  markOperatorWelcomeShownThisLogin,
  syncOperatorWelcomeFromLoginCookie,
} from "./operator-welcome-dismiss";
import { OperatorWelcomeDialog } from "./operator-welcome-dialog";
import {
  resolveOperatorWelcomeContent,
  shouldShowOperatorWelcome,
} from "./resolve-operator-welcome";

type OperatorWelcomeGateProps = {
  readonly pluginId: string;
  readonly role: string;
};

export function OperatorWelcomeGate({ pluginId, role }: OperatorWelcomeGateProps) {
  const welcomeContent = resolveOperatorWelcomeContent(pluginId);
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    syncOperatorWelcomeFromLoginCookie();

    if (!welcomeContent.active || !shouldShowOperatorWelcome(pluginId, role)) {
      return;
    }
    if (
      !isOperatorWelcomeArmedForLogin() ||
      isOperatorWelcomeShownThisLogin() ||
      isOperatorWelcomePresentedThisLogin()
    ) {
      return;
    }

    let cancelled = false;
    void fetch("/api/identity/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`WELCOME_PROFILE_HTTP_${response.status}`);
        }
        return (await response.json()) as OperatorProfile;
      })
      .then((profile) => {
        if (cancelled) {
          return;
        }
        setDisplayName(resolveProfileDisplayName(profile));
        markOperatorWelcomePresentedThisLogin();
        setOpen(true);
      })
      .catch(() => {
        // Silent fail — dashboard remains usable without welcome modal.
      });

    return () => {
      cancelled = true;
    };
  }, [pluginId, role, welcomeContent.active]);

  if (!welcomeContent.active || displayName === null) {
    return null;
  }

  return (
    <OperatorWelcomeDialog
      content={welcomeContent}
      displayName={displayName}
      onDismiss={() => {
        markOperatorWelcomeShownThisLogin();
      }}
      onOpenChange={setOpen}
      open={open}
      pluginId={pluginId}
      role={role}
    />
  );
}
