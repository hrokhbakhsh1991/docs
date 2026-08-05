"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalValue,
  setCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";
import {
  DENALI_SUBMIT_CATALOG_BFF_PATHS,
  isWizardLeaderCandidate,
} from "../../wizard/denali-wizard-catalog-sanitize";
import type { UsersListResponse } from "../adapters/catalog-types";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { resolveCodedErrorMessage } from "../adapters/i18n-errors";
import { Input } from "../adapters/platform-primitives";
import { LeaderPickerAvatar } from "../components/leader-picker-avatar";
import { CheckIcon } from "../components/icons/tour-service-icons";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { parseStringArray } from "../logic/denali-array-field-utils";
import {
  partitionLeaderChipPreview,
  resolveDenaliLeaderPickerDefaultExpanded,
  truncateLeaderDisplayName,
} from "../logic/denali-leader-picker-logic";
import { filterPickerItemsByQuery } from "../logic/denali-picker-filter-logic";
import { DENALI_LEADERS_TEST_IDS } from "../test-ids/denali-leaders-test-ids";

export { DENALI_LEADERS_TEST_IDS } from "../test-ids/denali-leaders-test-ids";

type DenaliLeaderUserIdsFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly invalid?: boolean;
};

function ChevronDownIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DenaliLeaderUserIdsField({
  draft,
  onDraftChange,
  invalid = false,
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
  const [pickerExpanded, setPickerExpanded] = useState(() =>
    resolveDenaliLeaderPickerDefaultExpanded(selected.length)
  );

  useEffect(() => {
    if (selected.length === 0) {
      setPickerExpanded(true);
    }
  }, [selected.length]);

  useEffect(() => {
    let cancelled = false;
    void fetch(DENALI_SUBMIT_CATALOG_BFF_PATHS.activeUsers, { cache: "no-store" })
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

  const userById = useMemo(() => new Map(users.map((user) => [user.userId, user])), [users]);

  const selectedUsers = useMemo(
    () =>
      selected
        .map((userId) => {
          const user = userById.get(userId);
          if (user == null) {
            return { userId, displayName: userId, avatarUrl: null };
          }
          return {
            userId,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl ?? null,
          };
        })
        .filter((entry) => entry.displayName.length > 0),
    [selected, userById]
  );

  const chipPreview = useMemo(() => partitionLeaderChipPreview(selectedUsers), [selectedUsers]);

  const filteredUsers = useMemo(
    () =>
      filterPickerItemsByQuery(users, searchQuery, (user) =>
        [user.displayName, user.phone].filter(Boolean).join(" ")
      ),
    [users, searchQuery]
  );

  const setSelected = (next: readonly string[]) => {
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalValue(base, "leaderUserIds", next)
    );
  };

  const toggleLeader = (userId: string) => {
    const next = selectedSet.has(userId)
      ? selected.filter((id) => id !== userId)
      : [...selected, userId];
    setSelected(next);
  };

  const removeLeader = (userId: string) => {
    setSelected(selected.filter((id) => id !== userId));
  };

  const showCollapsedSummary = selected.length > 0 && !pickerExpanded;

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-operator-leader-picker
      data-operator-leader-picker-expanded={pickerExpanded ? "true" : "false"}
      data-testid={DENALI_LEADERS_TEST_IDS.leaders}
      aria-invalid={invalid || undefined}
    >
      <div className="denali-wizard-composite__header denali-leader-picker__header">
        <div className="denali-leader-picker__header-row">
          <h3 className="denali-wizard-composite__title">{label}</h3>
          {selected.length > 0 ? (
            <button
              type="button"
              className="denali-leader-picker__toggle"
              data-testid={DENALI_LEADERS_TEST_IDS.toggle}
              aria-expanded={pickerExpanded}
              onClick={() => setPickerExpanded((open) => !open)}
            >
              <span>
                {pickerExpanded
                  ? t("composites.leaders.collapsePicker")
                  : t("composites.leaders.expandPicker")}
              </span>
              <ChevronDownIcon
                className={
                  pickerExpanded
                    ? "denali-leader-picker__toggle-icon denali-leader-picker__toggle-icon--open"
                    : "denali-leader-picker__toggle-icon"
                }
              />
            </button>
          ) : null}
        </div>
        <p className="denali-wizard-composite__helper">{t("composites.leaders.helper")}</p>
      </div>

      {showCollapsedSummary ? (
        <div className="denali-leader-picker__collapsed" data-testid={DENALI_LEADERS_TEST_IDS.chips}>
          <div className="denali-leader-picker__chip-row" role="list" aria-label={label}>
            {chipPreview.visible.map((user) => (
              <span
                key={user.userId}
                className="denali-leader-picker__chip"
                role="listitem"
                data-testid={DENALI_LEADERS_TEST_IDS.chip}
              >
                <LeaderPickerAvatar
                  displayName={user.displayName}
                  avatarUrl={user.avatarUrl}
                  size="chip"
                />
                <span className="denali-leader-picker__chip-name">
                  {truncateLeaderDisplayName(user.displayName)}
                </span>
                <button
                  type="button"
                  className="denali-leader-picker__chip-remove"
                  aria-label={t("composites.leaders.removeLeader", { name: user.displayName })}
                  onClick={() => removeLeader(user.userId)}
                >
                  ×
                </button>
              </span>
            ))}
            {chipPreview.overflowCount > 0 ? (
              <button
                type="button"
                className="denali-leader-picker__chip denali-leader-picker__chip--overflow"
                onClick={() => setPickerExpanded(true)}
              >
                {t("composites.leaders.overflowCount", { count: chipPreview.overflowCount })}
              </button>
            ) : null}
          </div>
          <p className="denali-leader-picker__summary">
            {t("composites.leaders.selectedCount", { count: selected.length })}
          </p>
        </div>
      ) : null}

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

      {pickerExpanded && users.length > 0 ? (
        <div className="denali-leader-picker__panel" data-testid={DENALI_LEADERS_TEST_IDS.panel}>
          {selected.length > 0 ? (
            <p className="denali-leader-picker__summary denali-leader-picker__summary--panel">
              {t("composites.leaders.selectedCount", { count: selected.length })}
            </p>
          ) : null}
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
                      data-operator-leader-card
                      aria-pressed={isSelected}
                      aria-label={user.displayName}
                      className={
                        isSelected
                          ? "denali-leader-picker__card denali-leader-picker__card--selected"
                          : "denali-leader-picker__card"
                      }
                      onClick={() => toggleLeader(user.userId)}
                    >
                      <LeaderPickerAvatar
                        displayName={user.displayName}
                        avatarUrl={user.avatarUrl}
                        size="card"
                      />
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
                        <CheckIcon />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
