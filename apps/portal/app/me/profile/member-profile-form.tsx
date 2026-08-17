"use client";

import { Input } from "@app-tour/ui-primitives/input";
import { useTranslations } from "next-intl";
import { useMemo, useState, useEffect } from "react";

import type { MemberProfileFieldId, MemberProfileViewProfile } from "@/me/member-profile-types";
import { MemberLogoutButton } from "@/me/member-logout-button";
import { resolveMemberProfileErrorMessage } from "@/me/resolve-member-profile-error";

import { MemberProfileAvatar } from "./member-profile-avatar";
import { MemberProfileGenderField } from "./member-profile-gender-field";
import { MemberProfileMobileChange } from "./member-profile-mobile-change";

type MemberProfileFormProps = {
  readonly profile: MemberProfileViewProfile;
  readonly logoutTarget: string;
};

type FieldSection = {
  readonly id: string;
  readonly fields: readonly MemberProfileFieldId[];
};

type FieldErrorMap = Partial<Record<MemberProfileFieldId, string>>;

function buildFieldSections(profile: MemberProfileViewProfile): readonly FieldSection[] {
  if (profile.capabilities.sections !== undefined && profile.capabilities.sections.length > 0) {
    return profile.capabilities.sections;
  }
  return [
    {
      id: "identity",
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
  // INV-MP-07 / coded errors — do not use HTML5 email validation messages.
  return "text";
}

function fieldInputMode(fieldId: MemberProfileFieldId): "numeric" | "email" | undefined {
  if (fieldId === "nationalId") {
    return "numeric";
  }
  if (fieldId === "email") {
    return "email";
  }
  return undefined;
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

export function MemberProfileForm({
  profile: initialProfile,
  logoutTarget,
}: MemberProfileFormProps) {
  const t = useTranslations("portalMember.profile");
  const tNav = useTranslations("portalMember.nav");
  const [profile, setProfile] = useState(initialProfile);
  const [fieldValues, setFieldValues] = useState(() => initialEditableValues(initialProfile));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    initialProfile.fields.avatarUrl ?? null
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrorMap>({});
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

  function updateFieldValue(fieldId: MemberProfileFieldId, nextValue: string): void {
    setFieldValues((current) => ({
      ...current,
      [fieldId]: nextValue,
    }));
    // INV-MP-ERR-01 clear-on-edit — presentation only; no re-validation in UI.
    setFieldErrors((current) => {
      if (current[fieldId] === undefined) {
        return current;
      }
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  }

  function handleAvatarChange(nextUrl: string | null): void {
    setAvatarUrl(nextUrl);
    setProfile((current) => ({
      ...current,
      fields: { ...current.fields, avatarUrl: nextUrl },
    }));
  }

  async function handleSubmit(): Promise<void> {
    setMessage(null);
    setError(null);
    setFieldErrors({});
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
        error?: { code?: string; fieldErrors?: FieldErrorMap };
        profile?: MemberProfileViewProfile;
      };
      if (!res.ok || payload.ok !== true || payload.profile === undefined) {
        const nextFieldErrors = payload.error?.fieldErrors ?? {};
        setFieldErrors(nextFieldErrors);
        // INV-MP-ERR-01: prefer per-field presentation; form alert only when no field map.
        if (Object.keys(nextFieldErrors).length === 0) {
          setError(resolveMemberProfileErrorMessage(t, payload.error?.code));
        } else {
          setError(null);
        }
        return;
      }
      const nextProfile = payload.profile;
      const nextAvatar = nextProfile.fields.avatarUrl ?? avatarUrl;
      setProfile({
        ...nextProfile,
        fields: { ...nextProfile.fields, avatarUrl: nextAvatar },
      });
      setAvatarUrl(nextAvatar ?? null);
      setFieldValues(initialEditableValues(nextProfile));
      setFieldErrors({});
      setMessage(t("saved"));
    } catch {
      setError(t("failed"));
    } finally {
      setLoading(false);
    }
  }

  /** INV-MP-AVATAR-01 / DL-43 — reset PATCH fields only; keep last successful server avatar. */
  function handleDiscard(): void {
    setFieldValues(initialEditableValues(profile));
    setMessage(null);
    setError(null);
    setFieldErrors({});
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
      data-portal-member-profile
      data-member-profile-layout="sectioned"
      data-member-profile-ready={ready ? "true" : undefined}
    >
      <section data-member-profile-card="photo">
        <MemberProfileAvatar
          userId={profile.userId}
          displayName={fieldValues.displayName ?? profile.fields.displayName}
          initialAvatarUrl={avatarUrl}
          onAvatarChange={handleAvatarChange}
        />
      </section>

      {sections.map((section) => (
        <fieldset key={section.id} data-member-profile-card={section.id}>
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

            const fieldErrorCode = fieldErrors[fieldId];
            const fieldErrorMessage =
              fieldErrorCode !== undefined
                ? resolveMemberProfileErrorMessage(t, fieldErrorCode)
                : null;
            const fieldErrorId = `profile-${fieldId}-error`;
            const controlId = `profile-${fieldId}`;

            return (
              <div key={fieldId} data-member-profile-field={fieldId}>
                {fieldId === "gender" ? (
                  <MemberProfileGenderField
                    id={controlId}
                    label={label}
                    value={fieldValues[fieldId] ?? ""}
                    invalid={fieldErrorCode !== undefined}
                    describedBy={fieldErrorMessage !== null ? fieldErrorId : undefined}
                    onChange={(nextValue) => updateFieldValue("gender", nextValue)}
                  />
                ) : (
                  <>
                    <label htmlFor={controlId}>{label}</label>
                    <Input
                      id={controlId}
                      name={fieldId}
                      type={fieldInputType(fieldId)}
                      inputMode={fieldInputMode(fieldId)}
                      value={fieldValues[fieldId] ?? ""}
                      aria-invalid={fieldErrorCode !== undefined ? true : undefined}
                      aria-describedby={
                        fieldErrorMessage !== null ? fieldErrorId : undefined
                      }
                      onChange={(event) => updateFieldValue(fieldId, event.target.value)}
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
                {fieldErrorMessage !== null ? (
                  <p id={fieldErrorId} role="alert" data-member-profile-field-error={fieldId}>
                    {fieldErrorMessage}
                  </p>
                ) : null}
              </div>
            );
          })}
        </fieldset>
      ))}

      {(error !== null || message !== null || editableFields.length > 0) ? (
        <div data-member-profile-footer>
          {error !== null ? (
            <p role="alert" data-member-profile-form-error>
              {error}
            </p>
          ) : null}
          {message !== null ? (
            <p role="status">
              {message}
            </p>
          ) : null}

          {editableFields.length > 0 ? (
            <div data-member-profile-actions>
              <button
                type="button"
                disabled={loading}
                data-member-profile-discard
                onClick={handleDiscard}
              >
                {t("discard")}
              </button>
              <button type="submit" disabled={loading} data-member-profile-save>
                {loading ? t("saving") : t("save")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <section data-member-profile-session data-member-profile-card="session">
        <div data-member-profile-session-header>
          <span aria-hidden="true" data-member-profile-session-mark />
          <div data-member-profile-session-copy>
            <h2 data-member-profile-session-title>{t("sessionTitle")}</h2>
            <p data-member-profile-session-hint>{t("sessionHint")}</p>
          </div>
        </div>
        <MemberLogoutButton
          logoutTarget={logoutTarget}
          logoutLabel={tNav("logout")}
          loggingOutLabel={tNav("loggingOut")}
        />
      </section>
    </form>
  );
}
