"use client";

import { TourInternalLink } from "@/features/tours/tour-internal-link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { OPERATOR_WIZARD_PATH } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TOURS_LIST_TEST_IDS } from "@/features/tours/query-model";
import { requestServerTourClone } from "@/tours/clone-tour-client";

type TourDuplicateActionsProps = {
  readonly tourId: string;
};

export function TourDuplicateActions({ tourId }: TourDuplicateActionsProps) {
  const router = useRouter();
  const t = useTranslations("tours.card");
  const [cloning, setCloning] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function handleServerClone(): Promise<void> {
    setCloning(true);
    setErrorCode(null);
    try {
      const created = await requestServerTourClone(tourId);
      router.push(`/tours/${encodeURIComponent(created.id)}/edit`);
    } catch (error) {
      const code = error instanceof Error ? error.message : "TOUR_CLONE_FAILED";
      setErrorCode(code);
    } finally {
      setCloning(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            aria-label={t("moreActions")}
            data-testid={TOURS_LIST_TEST_IDS.secondaryActions}
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden />
            <span>{t("moreActions")}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <TourInternalLink
              href={`${OPERATOR_WIZARD_PATH}?clone=${encodeURIComponent(tourId)}`}
              data-testid={TOURS_LIST_TEST_IDS.duplicate}
            >
              {t("duplicate")}
            </TourInternalLink>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={cloning}
            data-testid={TOURS_LIST_TEST_IDS.duplicateServer}
            onClick={() => {
              void handleServerClone();
            }}
          >
            {cloning ? t("duplicateServerLoading") : t("duplicateServer")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {errorCode !== null ? (
        <p className="text-xs text-destructive" role="alert">
          {t("duplicateServerError", { code: errorCode })}
        </p>
      ) : null}
    </div>
  );
}
