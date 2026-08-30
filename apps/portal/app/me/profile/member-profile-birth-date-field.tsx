"use client";

import { LocalizedDatePicker } from "@app-tour/localized-calendar/localized-date-picker";
import { useTranslations } from "next-intl";

import "./member-profile-calendar.css";

type MemberProfileBirthDateFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly invalid?: boolean;
  readonly describedBy?: string;
  readonly onChange: (value: string) => void;
};

export function MemberProfileBirthDateField({
  id,
  label,
  value,
  invalid,
  describedBy,
  onChange,
}: MemberProfileBirthDateFieldProps) {
  const t = useTranslations("portalMember.profile");
  const tCalendar = useTranslations("common.calendar");
  const hasValue = value.trim().length > 0;

  return (
    <>
      <label htmlFor={id}>{label}</label>
      <div data-member-profile-birth-date-control>
        <LocalizedDatePicker
          id={id}
          name="birthDate"
          value={value}
          onChange={onChange}
          invalid={invalid}
          aria-describedby={describedBy}
          placeholder={tCalendar("pickDate")}
          data-testid="member-profile-birth-date-picker"
          collisionSelectors={["[data-member-profile-actions]"]}
        />
        {hasValue ? (
          <button
            type="button"
            data-member-profile-birth-date-clear
            aria-label={t("birthDateClear")}
            onClick={() => onChange("")}
          >
            {t("birthDateClear")}
          </button>
        ) : null}
      </div>
    </>
  );
}
