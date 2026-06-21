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
    ? tApp("denaliTagline")
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
        className="max-h-[85vh] overflow-y-auto sm:max-w-md"
        data-denali-surface="card"
        data-testid={OPERATOR_WELCOME_TEST_IDS.dialog}
      >
        <DialogHeader className="space-y-3 text-start">
          <div
            className="flex items-center gap-3"
            data-testid={OPERATOR_WELCOME_TEST_IDS.brandMark}
          >
            <TenantBrandMark
              className="size-11 shrink-0 rounded-lg object-contain"
              imageClassName="size-11 shrink-0 rounded-lg object-contain"
              pluginId={pluginId}
              workspaceLabel={workspaceLabel}
            />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {workspaceLabel}
              </p>
            </div>
          </div>
          <DialogTitle data-testid={OPERATOR_WELCOME_TEST_IDS.title}>
            {isOwner ? t("titleOwner", { displayName }) : t("title", { displayName })}
          </DialogTitle>
          <DialogDescription className="space-y-2 text-base text-foreground/90">
            <span className="block">
              {isOwner
                ? t("subtitleOwner", { workspaceLabel })
                : t("subtitle", { workspaceLabel })}
            </span>
            {tagline ? (
              <span className="block text-sm text-muted-foreground">{tagline}</span>
            ) : null}
          </DialogDescription>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("lead")}</p>
        </DialogHeader>

        <ul className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-4 text-sm">
          {content.bullets.map((bullet) => (
            <li key={bullet.id} className="flex gap-2">
              <span aria-hidden className="text-primary">
                ✓
              </span>
              <span>{t(`bullets.${bullet.id}`)}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            data-testid={OPERATOR_WELCOME_TEST_IDS.dismissCta}
            onClick={requestClose}
            type="button"
            variant="outline"
          >
            {t("later")}
          </Button>
          <Button asChild data-testid={OPERATOR_WELCOME_TEST_IDS.primaryCta}>
            <Link href={OPERATOR_WIZARD_PATH} onClick={requestClose}>
              {t("primaryCta")}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
