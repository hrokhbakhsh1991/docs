"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatLocalizedNumber } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";

const AMEND_OCCUPANT_OPTIONS = [1, 2, 3] as const;

type TransportKind = "primary" | "personal_car" | "no_car_dong" | "no_car_acquaintance";

type Props = {
  readonly registrationId: string;
  readonly allowPersonalCar: boolean;
  readonly sharedCarsMode: boolean;
  readonly dongAvailable: boolean;
  readonly initialKind?: TransportKind;
  readonly initialOccupants?: 1 | 2 | 3;
};

function resolveAmendKind(initialKind: TransportKind | undefined, sharedCarsMode: boolean): TransportKind {
  if (
    initialKind === "primary" ||
    initialKind === "personal_car" ||
    initialKind === "no_car_dong" ||
    initialKind === "no_car_acquaintance"
  ) {
    return initialKind;
  }
  return sharedCarsMode ? "personal_car" : "primary";
}

function resolveAmendOccupants(initialOccupants: 1 | 2 | 3 | undefined): 1 | 2 | 3 {
  return initialOccupants === 2 || initialOccupants === 3 ? initialOccupants : 1;
}

export function MemberIntakeAmendForm({
  registrationId,
  allowPersonalCar,
  sharedCarsMode,
  dongAvailable,
  initialKind,
  initialOccupants,
}: Props) {
  const t = useTranslations("portalMember.intakeAmend");
  const locale = useLocale() as AppLocale;
  const [kind, setKind] = useState<TransportKind>(() => resolveAmendKind(initialKind, sharedCarsMode));
  const [occupants, setOccupants] = useState<1 | 2 | 3>(() => resolveAmendOccupants(initialOccupants));
  const [phase, setPhase] = useState<"idle" | "saving" | "saved" | "error">("idle");

  if (!allowPersonalCar && !sharedCarsMode) {
    return null;
  }

  async function save(): Promise<void> {
    setPhase("saving");
    const transport =
      kind === "personal_car"
        ? { kind: "personal_car" as const, personalCarOccupants: occupants }
        : { kind };
    try {
      const res = await fetch(
        `/api/me/registrations/${encodeURIComponent(registrationId)}/intake`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ transport }),
        }
      );
      if (!res.ok) {
        setPhase("error");
        return;
      }
      setPhase("saved");
    } catch {
      setPhase("error");
    }
  }

  return (
    <section data-portal-member-intake-amend>
      <div data-portal-member-detail-section-heading>
        <p data-portal-member-intake-eyebrow>{t("eyebrow")}</p>
        <h2>{t("title")}</h2>
        <p>{t("lede")}</p>
      </div>
      <fieldset data-portal-member-intake-options>
        <legend>{t("transportLegend")}</legend>
        {!sharedCarsMode ? (
          <label
            data-portal-member-intake-option
            data-checked={kind === "primary" ? "true" : undefined}
          >
            <input
              type="radio"
              name="amend-transport"
              checked={kind === "primary"}
              onChange={() => setKind("primary")}
            />
            <span data-portal-member-intake-option-copy>
              <span data-portal-member-intake-option-title>{t("noPersonalCar")}</span>
            </span>
          </label>
        ) : null}
        <label
          data-portal-member-intake-option
          data-checked={kind === "personal_car" ? "true" : undefined}
        >
          <input
            type="radio"
            name="amend-transport"
            checked={kind === "personal_car"}
            onChange={() => setKind("personal_car")}
          />
          <span data-portal-member-intake-option-copy>
            <span data-portal-member-intake-option-title>{t("personalCar")}</span>
          </span>
        </label>
        {dongAvailable ? (
          <label
            data-portal-member-intake-option
            data-checked={kind === "no_car_dong" ? "true" : undefined}
          >
            <input
              type="radio"
              name="amend-transport"
              checked={kind === "no_car_dong"}
              onChange={() => setKind("no_car_dong")}
            />
            <span data-portal-member-intake-option-copy>
              <span data-portal-member-intake-option-title>{t("noCarDong")}</span>
            </span>
          </label>
        ) : null}
        {sharedCarsMode || allowPersonalCar ? (
          <label
            data-portal-member-intake-option
            data-checked={kind === "no_car_acquaintance" ? "true" : undefined}
          >
            <input
              type="radio"
              name="amend-transport"
              checked={kind === "no_car_acquaintance"}
              onChange={() => setKind("no_car_acquaintance")}
            />
            <span data-portal-member-intake-option-copy>
              <span data-portal-member-intake-option-title>{t("noCarAcquaintance")}</span>
            </span>
          </label>
        ) : null}
      </fieldset>
      {kind === "personal_car" ? (
        <label data-portal-member-intake-occupants>
          <span data-portal-member-intake-occupants-label>{t("occupants")}</span>
          <select
            value={occupants}
            onChange={(event) => setOccupants(Number(event.target.value) as 1 | 2 | 3)}
          >
            {AMEND_OCCUPANT_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {formatLocalizedNumber(value, locale)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div data-portal-member-intake-actions>
        <button type="button" disabled={phase === "saving"} onClick={() => void save()}>
          {phase === "saving" ? t("saving") : t("save")}
        </button>
      </div>
      {phase === "saved" ? (
        <p role="status" data-portal-member-intake-amend-saved>
          {t("saved")}
        </p>
      ) : null}
      {phase === "error" ? (
        <p role="alert" data-portal-member-intake-amend-error>
          {t("error")}
        </p>
      ) : null}
    </section>
  );
}
