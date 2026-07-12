"use client";

import { Input } from "@app-tour/ui-primitives/input";
import { useTranslations } from "next-intl";
import { useMemo, useState, useEffect } from "react";

import type { MemberProfileFieldId, MemberProfileViewProfile } from "@/me/member-profile-types";
import { resolveMemberProfileErrorMessage } from "@/me/resolve-member-profile-error";

import { MemberProfileAvatar } from "./member-profile-avatar";
import { MemberProfileGenderField } from "./member-profile-gender-field";
import { MemberProfileMobileChange } from "./member-profile-mobile-change";

type MemberProfileFormProps = {
  readonly profile: MemberProfileViewProfile;
};

type FieldSection = {
  readonly id: string;
  readonly fields: readonly MemberProfileFieldId[];
};

function buildFieldSections(profile: MemberProfileViewProfile): readonly FieldSection[] {
  if (profile.capabilities.sections !== undefined && profile.capabilities.sections.length > 0) {
    return profile.capabilities.sections;
  }
  return [
    {
      id: "profile",
      fields: [
        ...profile.capabilities.editableFields,
        ...profile.capabilities.readOnlyFields,
      ],
    },
  ];
}

function fieldInputType(fieldId: MemberProfileFieldId): string {
  if (fieldId === "birthDate") {
    return "date";
  }
  if (fieldId === "email") {
    return "email";
  }
  return "text";
}

function fieldInputMode(fieldId: MemberProfileFieldId): "numeric" | undefined {
  return fieldId === "nationalId" ? "numeric" : undefined;
}

function initialEditableValues(
  profile: MemberProfileViewProfile
): Record<MemberProfileFieldId, string> {
  const values = {} as Record<MemberProfileFieldId, string>;
  for (const fieldId of profile.capabilities.editableFields) {
    values[fieldId] = profile.fields[fieldId] ?? "";
  }
  return values;
}

function sectionLegendKey(sectionId: string): string {
  return `sectionLabels.${sectionId}`;
}

export function MemberProfileForm({ profile: initialProfile }: MemberProfileFormProps) {
  const t = useTranslations("portalMember.profile");
  const [profile, setProfile] = useState(initialProfile);
  const [fieldValues, setFieldValues] = useState(() => initialEditableValues(initialProfile));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initialProfile.fields.avatarUrl ?? null
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const sections = useMemo(() => buildFieldSections(profile), [profile]);
  const editableFields = profile.capabilities.editableFields;
  const readOnlyFieldSet = useMemo(
    () => new Set(profile.capabilities.readOnlyFields),
    [profile.capabilities.readOnlyFields]
  );
  const mobileChangeViaOtp = profile.capabilities.mobileChangeViaOtp === true;

  async function handleSubmit(): Promise<void> {
    setMessage(null);
    setError(null);
    setLoading(true);

    const fields: Partial<Record<MemberProfileFieldId, string | null>> = {};
    for (const fieldId of editableFields) {
      const trimmed = (fieldValues[fieldId] ?? "").trim();
      fields[fieldId] = trimmed.length > 0 ? trimmed : null;
    }

    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fields }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { code?: string };
        profile?: MemberProfileViewProfile;
      };
      if (!res.ok || payload.ok !== true || payload.profile === undefined) {
        setError(resolveMemberProfileErrorMessage(t, payload.error?.code));
        return;
      }
      setProfile(payload.profile);
      setFieldValues(initialEditableValues(payload.profile));
      setMessage(t("saved"));
    } catch {
      setError(t("failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
      data-portal-member-profile
      data-member-profile-ready={ready ? "true" : undefined}
    >
      <MemberProfileAvatar
        userId={profile.userId}
        displayName={fieldValues.displayName ?? profile.fields.displayName}
        initialAvatarUrl={avatarUrl}
        onAvatarChange={setAvatarUrl}
      />

      {sections.map((section) => (
        <fieldset key={section.id}>
          <legend>{t(sectionLegendKey(section.id))}</legend>
          {section.fields.map((fieldId) => {
            const label = t(`fieldLabels.${fieldId}`);
            if (readOnlyFieldSet.has(fieldId)) {
              if (fieldId === "mobile" && mobileChangeViaOtp) {
                return (
                  <MemberProfileMobileChange
                    key={fieldId}
                    currentMobile={profile.fields.mobile}
                    onMobileChanged={(mobile) => {
                      setProfile((current) => ({
                        ...current,
                        fields: { ...current.fields, mobile },
                      }));
                    }}
                  />
                );
              }
              return (
                <div key={fieldId} data-member-profile-field={fieldId}>
                  <p>{label}</p>
                  <p>{profile.fields[fieldId] ?? "—"}</p>
                  {fieldId === "mobile" && !mobileChangeViaOtp ? (
                    <p data-member-profile-field-hint>{t("mobileReadOnlyHint")}</p>
                  ) : null}
                </div>
              );
            }

            return (
              <div key={fieldId} data-member-profile-field={fieldId}>
                {fieldId === "gender" ? (
                  <MemberProfileGenderField
                    id={`profile-${fieldId}`}
                    label={label}
                    value={fieldValues[fieldId] ?? ""}
                    onChange={(nextValue) =>
                      setFieldValues((current) => ({
                        ...current,
                        gender: nextValue,
                      }))
                    }
                  />
                ) : (
                  <>
                    <label htmlFor={`profile-${fieldId}`}>{label}</label>
                    <Input
                      id={`profile-${fieldId}`}
                      name={fieldId}
                      type={fieldInputType(fieldId)}
                      inputMode={fieldInputMode(fieldId)}
                      value={fieldValues[fieldId] ?? ""}
                      onChange={(event) =>
                        setFieldValues((current) => ({
                          ...current,
                          [fieldId]: event.target.value,
                        }))
                      }
                      autoComplete={
                        fieldId === "email"
                          ? "email"
                          : fieldId === "displayName"
                            ? "name"
                            : "off"
                      }
                    />
                  </>
                )}
              </div>
            );
          })}
        </fieldset>
      ))}

      {error !== null ? (
        <p role="alert">
          {error}
        </p>
      ) : null}
      {message !== null ? (
        <p role="status">
          {message}
        </p>
      ) : null}

      {editableFields.length > 0 ? (
        <button
          type="button"
          disabled={loading}
          data-member-profile-save
          onClick={() => void handleSubmit()}
        >
          {loading ? t("saving") : t("save")}
        </button>
      ) : null}
    </form>
  );
}
