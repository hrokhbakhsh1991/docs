"use client";

import { Check } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@app-tour/ui-primitives/input";
import { useTranslations } from "next-intl";

import type { UsersListResponse } from "@/features/users/users-directory-types";
import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";
import { commitWizardDraftEdit, useLatestWizardDraft } from "@/wizard/use-latest-wizard-draft";

import { parseStringArray } from "./denali-array-field-utils";
import { isWizardLeaderCandidate } from "./denali-catalog-sanitize";
import { leaderDisplayInitials } from "./denali-leader-picker-logic";
import { filterPickerItemsByQuery } from "./denali-picker-filter-logic";

export const DENALI_LEADERS_TEST_IDS = {
  leaders: "denali-composite-leader-user-ids",
  card: "denali-leader-picker-card",
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
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, "leaderUserIds");
  const selected = parseStringArray(getCanonicalValue(draft, "leaderUserIds"));
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const [users, setUsers] = useState<UsersListResponse["items"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/users?role=all&status=active", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`USERS_HTTP_${response.status}`);
        }
        return (await response.json()) as UsersListResponse;
      })
      .then((payload) => {
        if (!cancelled) {
          const items = payload.items ?? [];
          const leaders = items.filter((user) => isWizardLeaderCandidate(user));
          setUsers(leaders);
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

  const filteredUsers = useMemo(
    () =>
      filterPickerItemsByQuery(users, searchQuery, (user) =>
        [user.displayName, user.phone].filter(Boolean).join(" ")
      ),
    [users, searchQuery]
  );

  const toggleLeader = (userId: string) => {
    const next = selectedSet.has(userId)
      ? selected.filter((id) => id !== userId)
      : [...selected, userId];
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalValue(base, "leaderUserIds", next)
    );
  };

  return (
    <div
      className="denali-wizard-composite"
      data-denali-wizard-surface="section"
      data-denali-leader-picker
      data-testid={DENALI_LEADERS_TEST_IDS.leaders}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.leaders.helper")}</p>
        {selected.length > 0 ? (
          <p className="denali-leader-picker__summary">
            {t("composites.leaders.selectedCount", { count: selected.length })}
          </p>
        ) : null}
      </div>

      {loading ? (
        <p className="denali-wizard-composite__status">{t("composites.leaders.loading")}</p>
      ) : null}
      {error !== null ? (
        <p className="denali-wizard-composite__error">{resolveCodedErrorMessage(tErrors, error)}</p>
      ) : null}

      {!loading && users.length === 0 && error === null ? (
        <div className="denali-leader-picker__empty">
          <p className="denali-wizard-composite__status">{t("composites.leaders.empty")}</p>
          <a className="denali-wizard-composite__link" href="/users">
            {t("composites.leaders.openUsers")}
          </a>
        </div>
      ) : null}

      {users.length > 0 ? (
        <>
          <label className="denali-wizard-picker__search">
            <span className="denali-wizard-picker__search-label">{t("composites.leaders.searchLabel")}</span>
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("composites.leaders.searchPlaceholder")}
              aria-label={t("composites.leaders.searchLabel")}
            />
          </label>
          {filteredUsers.length === 0 ? (
            <p className="denali-wizard-composite__status">{t("composites.leaders.searchEmpty")}</p>
          ) : (
            <div className="denali-wizard-picker__scroll">
              <div className="denali-leader-picker__grid" role="list">
                {filteredUsers.map((user) => {
            const isSelected = selectedSet.has(user.userId);
            const showLeaderBadge = user.isSelectableLeader === true;
            const showAdminBadge =
              !showLeaderBadge && (user.role === "admin" || user.role === "owner");
            return (
              <button
                key={user.userId}
                type="button"
                role="listitem"
                data-testid={DENALI_LEADERS_TEST_IDS.card}
                data-denali-leader-card
                aria-pressed={isSelected}
                aria-label={user.displayName}
                className={
                  isSelected
                    ? "denali-leader-picker__card denali-leader-picker__card--selected"
                    : "denali-leader-picker__card"
                }
                onClick={() => toggleLeader(user.userId)}
              >
                <span className="denali-leader-picker__avatar" aria-hidden>
                  {leaderDisplayInitials(user.displayName)}
                </span>
                <span className="denali-leader-picker__body">
                  <span className="denali-leader-picker__name">{user.displayName}</span>
                  {user.phone ? (
                    <span className="denali-leader-picker__phone" dir="ltr">
                      {user.phone}
                    </span>
                  ) : null}
                  {showLeaderBadge || showAdminBadge ? (
                    <span className="denali-leader-picker__badges">
                      {showLeaderBadge ? (
                        <span className="denali-leader-picker__badge denali-leader-picker__badge--leader">
                          {t("composites.leaders.leaderBadge")}
                        </span>
                      ) : null}
                      {showAdminBadge ? (
                        <span className="denali-leader-picker__badge denali-leader-picker__badge--admin">
                          {t("composites.leaders.adminBadge")}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                <span
                  className={
                    isSelected
                      ? "denali-leader-picker__check denali-leader-picker__check--visible"
                      : "denali-leader-picker__check"
                  }
                  aria-hidden
                >
                  <Check />
                </span>
              </button>
            );
          })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
