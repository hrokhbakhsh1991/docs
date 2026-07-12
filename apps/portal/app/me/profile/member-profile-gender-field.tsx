"use client";

import { OPERATOR_PROFILE_GENDERS } from "@app-tour/workspace-sdk";
import { useTranslations } from "next-intl";

type MemberProfileGenderFieldProps = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
};

export function MemberProfileGenderField({
  id,
  label,
  value,
  onChange,
}: MemberProfileGenderFieldProps) {
  const t = useTranslations("portalMember.profile");

  return (
    <div data-member-profile-field="gender">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        name="gender"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="sex"
      >
        <option value="">{t("genderOptions.unset")}</option>
        {OPERATOR_PROFILE_GENDERS.map((genderValue) => (
          <option key={genderValue} value={genderValue}>
            {t(`genderOptions.${genderValue}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
