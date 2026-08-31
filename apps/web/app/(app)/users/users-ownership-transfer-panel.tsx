"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Crown } from "lucide-react";

import { OperatorConfirmDialog } from "@/admin/patterns/operator-confirm-dialog";
import { clearOperatorWelcomeSession } from "@/admin/onboarding/operator-welcome-dismiss";
import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  USERS_DIRECTORY_TEST_IDS,
  type UsersDirectoryRow,
  type UsersListResponse,
} from "@/features/users/users-directory-types";
import {
  eligibleOwnershipTransferTargets,
  type TransferWorkspaceOwnershipResponse,
} from "@/features/users/users-ownership-transfer-logic";

import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

type UsersOwnershipTransferPanelProps = {
  readonly session: OperatorSessionContext;
  readonly initialRoster?: readonly UsersDirectoryRow[] | null;
  readonly onInviteClick?: () => void;
};

export function UsersOwnershipTransferPanel({
  session,
  initialRoster = null,
  onInviteClick,
}: UsersOwnershipTransferPanelProps) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("users.errors");
  const router = useRouter();
  const [roster, setRoster] = useState<readonly UsersDirectoryRow[]>(initialRoster ?? []);
  const [loading, setLoading] = useState(initialRoster === null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  const skipInitialFetchRef = useRef(initialRoster !== null);

  useEffect(() => {
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void fetch("/api/users?limit=100&sort=name_asc", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`USERS_LIST_HTTP_${response.status}`);
        }
        return (await response.json()) as UsersListResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          setRoster(payload.items);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "USERS_LIST_FAILED");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const candidates = useMemo(
    () => eligibleOwnershipTransferTargets(roster, session.userId),
    [roster, session.userId]
  );

  useEffect(() => {
    if (selectedUserId.length > 0 && !candidates.some((row) => row.userId === selectedUserId)) {
      setSelectedUserId("");
    }
  }, [candidates, selectedUserId]);

  const selectedCandidate = candidates.find((row) => row.userId === selectedUserId) ?? null;

  const handleTransfer = async () => {
    if (selectedUserId.length === 0 || selectedCandidate === null) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(
        `/api/tenants/${session.tenantId}/ownership-transfer`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newOwnerUserId: selectedUserId }),
        }
      );
      if (!response.ok) {
        throw new Error(`OWNERSHIP_TRANSFER_HTTP_${response.status}`);
      }
      const payload = (await response.json()) as TransferWorkspaceOwnershipResponse;
      if (payload.newOwnerUserId !== selectedUserId) {
        throw new Error("OWNERSHIP_TRANSFER_INVALID_RESPONSE");
      }
      clearOperatorWelcomeSession();
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/auth/login?access=ownership-transferred");
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : "OWNERSHIP_TRANSFER_FAILED");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card data-testid={USERS_DIRECTORY_TEST_IDS.ownershipTransfer}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Crown className="h-5 w-5" />
          {t("ownershipTransfer.title")}
        </CardTitle>
        <CardDescription>{t("ownershipTransfer.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t("ownershipTransfer.loading")}</p>
        ) : null}
        {loadError ? (
          <p role="alert" className="text-sm text-destructive">
            {resolveCodedErrorMessage(tErrors, loadError)}
          </p>
        ) : null}
        {!loading && !loadError && candidates.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("ownershipTransfer.soleOwnerHint")}</p>
            {onInviteClick ? (
              <Button
                type="button"
                variant="outline"
                data-testid={USERS_DIRECTORY_TEST_IDS.ownershipTransferInvite}
                onClick={onInviteClick}
              >
                {t("ownershipTransfer.inviteCta")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {!loading && !loadError && candidates.length > 0 ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="ownership-transfer-select">{t("ownershipTransfer.selectLabel")}</Label>
              <select
                id="ownership-transfer-select"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid={USERS_DIRECTORY_TEST_IDS.ownershipTransferSelect}
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
              >
                <option value="">{t("ownershipTransfer.selectPlaceholder")}</option>
                {candidates.map((candidate) => (
                  <option key={candidate.userId} value={candidate.userId}>
                    {candidate.displayName} ({t(`roles.${candidate.role}`)})
                  </option>
                ))}
              </select>
            </div>
            {selectedCandidate ? (
              <p className="text-sm text-muted-foreground">
                {t("ownershipTransfer.preview", {
                  name: selectedCandidate.displayName,
                  role: t(`roles.${selectedCandidate.role}`),
                })}
              </p>
            ) : null}
            {submitError ? (
              <p role="alert" className="text-sm text-destructive">
                {resolveCodedErrorMessage(tErrors, submitError)}
              </p>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              disabled={submitting || selectedUserId.length === 0}
              data-testid={USERS_DIRECTORY_TEST_IDS.ownershipTransferSubmit}
              onClick={() => setTransferConfirmOpen(true)}
            >
              {submitting ? t("ownershipTransfer.submitting") : t("ownershipTransfer.submit")}
            </Button>
          </>
        ) : null}
      </CardContent>
      <OperatorConfirmDialog
        open={transferConfirmOpen && selectedCandidate !== null}
        title={t("ownershipTransfer.title")}
        description={
          selectedCandidate !== null
            ? t("ownershipTransfer.confirm", { name: selectedCandidate.displayName })
            : ""
        }
        cancelLabel={tCommon("cancel")}
        confirmLabel={t("ownershipTransfer.submit")}
        confirmPending={submitting}
        testIdPrefix="operator-users-ownership-transfer"
        onOpenChange={setTransferConfirmOpen}
        onConfirm={() => {
          setTransferConfirmOpen(false);
          void handleTransfer();
        }}
      />
    </Card>
  );
}
