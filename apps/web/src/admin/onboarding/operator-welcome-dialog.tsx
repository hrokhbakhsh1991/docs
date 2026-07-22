"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

import { OPERATOR_WIZARD_PATH } from "@/admin/require-operator-session";
import { WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS } from "@/bootstrap/wizard-create-bindings.generated";
import { TenantBrandMark } from "@/admin/shell/tenant-brand-mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTenantBrandTitle } from "@/tenant/tenant-branding-context";

import { OPERATOR_WELCOME_TEST_IDS, type OperatorWelcomeContent } from "./operator-welcome-types";

type OperatorWelcomeDialogProps = {
  readonly open: boolean;
  readonly displayName: string;
  readonly pluginId: string;
  readonly role: string;
  readonly content: OperatorWelcomeContent;
  readonly onOpenChange: (open: boolean) => void;
  readonly onDismiss: () => void;
};

export function OperatorWelcomeDialog({
  open,
  displayName,
  pluginId,
  role,
  content,
  onOpenChange,
  onDismiss,
}: OperatorWelcomeDialogProps) {
  const t = useTranslations("dashboard.welcome");
  const tApp = useTranslations("app");
  const workspaceLabel = useTenantBrandTitle();

  const tagline = WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS.has(pluginId)
    ? tApp("extendedCreateChromeTagline")
    : null;
  const isOwner = role === "owner";

  const requestClose = () => {
    if (!open) {
      return;
    }
    onDismiss();
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      requestClose();
      return;
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-operator-welcome-dialog
        data-operator-surface="card"
        data-testid={OPERATOR_WELCOME_TEST_IDS.dialog}
      >
        <DialogHeader data-operator-welcome-header>
          <div data-operator-welcome-brand-row data-testid={OPERATOR_WELCOME_TEST_IDS.brandMark}>
            <TenantBrandMark pluginId={pluginId} workspaceLabel={workspaceLabel} />
            <div data-operator-welcome-brand-copy>
              <p data-operator-welcome-workspace-label>{workspaceLabel}</p>
            </div>
          </div>
          <DialogTitle data-testid={OPERATOR_WELCOME_TEST_IDS.title}>
            {isOwner ? t("titleOwner", { displayName }) : t("title", { displayName })}
          </DialogTitle>
          <DialogDescription data-operator-welcome-description>
            <span data-operator-welcome-description-line>
              {isOwner
                ? t("subtitleOwner", { workspaceLabel })
                : t("subtitle", { workspaceLabel })}
            </span>
            {tagline ? <span data-operator-welcome-tagline>{tagline}</span> : null}
          </DialogDescription>
          <p data-operator-welcome-lead>{t("lead")}</p>
        </DialogHeader>

        <ul data-operator-welcome-bullets>
          {content.bullets.map((bullet) => (
            <li key={bullet.id} data-operator-welcome-bullet>
              <span aria-hidden data-operator-welcome-bullet-icon>
                ✓
              </span>
              <span data-operator-welcome-bullet-text>{t(`bullets.${bullet.id}`)}</span>
            </li>
          ))}
        </ul>

        <DialogFooter data-operator-welcome-footer>
          <Button
            data-operator-welcome-cta
            data-testid={OPERATOR_WELCOME_TEST_IDS.dismissCta}
            onClick={requestClose}
            type="button"
            variant="outline"
          >
            {t("later")}
          </Button>
          <Button
            asChild
            data-operator-welcome-cta
            data-testid={OPERATOR_WELCOME_TEST_IDS.primaryCta}
          >
            <Link href={OPERATOR_WIZARD_PATH} onClick={requestClose}>
              {t("primaryCta")}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
