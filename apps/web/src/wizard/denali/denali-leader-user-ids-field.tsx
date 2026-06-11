"use client";

import React, { useEffect, useState } from "react";
import { Checkbox } from "@app-tour/ui-primitives/checkbox";
import { useTranslations } from "next-intl";

import type { UsersListResponse } from "@/features/users/users-directory-types";
import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import { parseStringArray } from "./denali-array-field-utils";

export const DENALI_LEADERS_TEST_IDS = {
  leaders: "denali-composite-leader-user-ids",
} as const;

type DenaliLeaderUserIdsFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
};

export function DenaliLeaderUserIdsField({
  draft,
  onDraftChange,
}: DenaliLeaderUserIdsFieldProps) {
  const t = useTranslations("denali");
  const tErrors = useTranslations("settings.errors");
  const label = resolveDenaliFieldLabel(t, "leaderUserIds");
  const selected = parseStringArray(getCanonicalValue(draft, "leaderUserIds"));
  const selectedSet = new Set(selected);
  const [users, setUsers] = useState<UsersListResponse["items"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/users?role=all&tab=active", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`USERS_HTTP_${response.status}`);
        }
        return (await response.json()) as UsersListResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          const items = payload.items ?? [];
          const leaders = items.filter(
            (user) =>
              user.isSelectableLeader === true ||
              user.role === "admin" ||
              user.role === "owner"
          );
          setUsers(leaders.length > 0 ? leaders : items);
          setError(null);
        }
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "USERS_LOAD_FAILED");
          setUsers([]);
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

  const toggleLeader = (userId: string, checked: boolean) => {
    const next = checked
      ? [...selected, userId]
      : selected.filter((id) => id !== userId);
    onDraftChange(setCanonicalValue(draft, "leaderUserIds", next));
  };

  return (
    <div className="denali-wizard-composite" data-denali-wizard-surface="section" data-testid={DENALI_LEADERS_TEST_IDS.leaders}>
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.leaders.helper")}</p>
      </div>

      {loading ? (
        <p className="denali-wizard-composite__status">{t("composites.leaders.loading")}</p>
      ) : null}
      {error !== null ? (
        <p className="denali-wizard-composite__error">{resolveCodedErrorMessage(tErrors, error)}</p>
      ) : null}

      {!loading && users.length === 0 && error === null ? (
        <p className="denali-wizard-composite__status">{t("composites.leaders.empty")}</p>
      ) : null}

      {users.map((user) => (
        <label key={user.userId} className="denali-wizard-composite__field-row">
          <Checkbox
            aria-label={user.displayName}
            checked={selectedSet.has(user.userId)}
            onChange={(event) => toggleLeader(user.userId, event.target.checked)}
          />
          <span>{user.displayName}</span>
          {user.phone ? (
            <span className="denali-wizard-composite__helper">{user.phone}</span>
          ) : null}
        </label>
      ))}
    </div>
  );
}
