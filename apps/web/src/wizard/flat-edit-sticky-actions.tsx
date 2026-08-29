"use client";

import type { DraftStatus } from "@app-tour/draft-engine";
import { Loader2, MoreHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TOUR_EDIT_TEST_IDS } from "@/features/tours/operator-tour-detail-types";
import { TourInternalLink } from "@/features/tours/tour-internal-link";

type OperatorFlatEditStickyActionBarProps = {
  readonly saveLabel: string;
  readonly saveDisabled: boolean;
  readonly saveBusy: boolean;
  readonly onSave: () => void;
  readonly canPublish: boolean;
  readonly canUnpublish: boolean;
  readonly publishDisabled: boolean;
  readonly unpublishDisabled: boolean;
  readonly publishLabel: string;
  readonly unpublishLabel: string;
  readonly onPublish: () => void;
  readonly onUnpublish: () => void;
  readonly cancelLabel: string;
  readonly draftStatus: DraftStatus;
  readonly saved: boolean;
  readonly published: boolean;
  readonly unpublished: boolean;
  readonly savedLabel: string;
  readonly publishedLabel: string;
  readonly unpublishedLabel: string;
};

export function OperatorFlatEditStickyActionBar({
  saveLabel,
  saveDisabled,
  saveBusy,
  onSave,
  canPublish,
  canUnpublish,
  publishDisabled,
  unpublishDisabled,
  publishLabel,
  unpublishLabel,
  onPublish,
  onUnpublish,
  cancelLabel,
  draftStatus,
  saved,
  published,
  unpublished,
  savedLabel,
  publishedLabel,
  unpublishedLabel,
}: OperatorFlatEditStickyActionBarProps) {
  const t = useTranslations("tours.edit");
  const showLifecycleMenu = canPublish || canUnpublish;

  const feedbackLabel = published
    ? publishedLabel
    : unpublished
      ? unpublishedLabel
      : saved
        ? savedLabel
        : null;

  return (
    <div
      className="new-tour-wizard-page__sticky-actions"
      data-operator-flat-edit-sticky-actions
      data-testid={TOUR_EDIT_TEST_IDS.stickyActions}
    >
      <div className="new-tour-wizard-page__sticky-actions-main">
        <Button
          type="button"
          data-testid={TOUR_EDIT_TEST_IDS.save}
          disabled={saveDisabled}
          aria-busy={saveBusy ? true : undefined}
          onClick={onSave}
        >
          {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {saveLabel}
        </Button>

        {showLifecycleMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                aria-label={t("moreActions")}
                data-testid={TOUR_EDIT_TEST_IDS.lifecycleMenu}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
                <span className="hidden sm:inline">{t("moreActions")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canPublish ? (
                <DropdownMenuItem
                  data-testid={TOUR_EDIT_TEST_IDS.publish}
                  disabled={publishDisabled}
                  onSelect={() => onPublish()}
                >
                  {publishLabel}
                </DropdownMenuItem>
              ) : null}
              {canUnpublish ? (
                <DropdownMenuItem
                  data-testid={TOUR_EDIT_TEST_IDS.unpublish}
                  disabled={unpublishDisabled}
                  onSelect={() => onUnpublish()}
                >
                  {unpublishLabel}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <TourInternalLink
                  href="/tours"
                  data-testid={TOUR_EDIT_TEST_IDS.cancel}
                >
                  {cancelLabel}
                </TourInternalLink>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            asChild
            variant="ghost"
            size="sm"
            data-testid={TOUR_EDIT_TEST_IDS.cancel}
          >
            <TourInternalLink href="/tours">{cancelLabel}</TourInternalLink>
          </Button>
        )}
      </div>

      {draftStatus === "DIRTY" ? (
        <p className="new-tour-wizard-page__sticky-actions-hint" role="status">
          {t("unsavedHint")}
        </p>
      ) : feedbackLabel != null ? (
        <p className="new-tour-wizard-page__sticky-actions-hint" role="status">
          {feedbackLabel}
        </p>
      ) : null}
    </div>
  );
}
