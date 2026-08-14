"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

type TransportKind = "primary" | "personal_car" | "no_car_dong" | "no_car_acquaintance";

type Props = {
  readonly registrationId: string;
  readonly allowPersonalCar: boolean;
  readonly sharedCarsMode: boolean;
  readonly dongAvailable: boolean;
};

export function MemberIntakeAmendForm({
  registrationId,
  allowPersonalCar,
  sharedCarsMode,
  dongAvailable,
}: Props) {
  const t = useTranslations("portalMember.intakeAmend");
  const [kind, setKind] = useState<TransportKind>(sharedCarsMode ? "personal_car" : "primary");
  const [occupants, setOccupants] = useState<1 | 2 | 3>(1);
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
      <h2>{t("title")}</h2>
      <p>{t("lede")}</p>
      <fieldset>
        <legend>{t("transportLegend")}</legend>
        {!sharedCarsMode ? (
          <label>
            <input
              type="radio"
              name="amend-transport"
              checked={kind === "primary"}
              onChange={() => setKind("primary")}
            />
            {t("noPersonalCar")}
          </label>
        ) : null}
        <label>
          <input
            type="radio"
            name="amend-transport"
            checked={kind === "personal_car"}
            onChange={() => setKind("personal_car")}
          />
          {t("personalCar")}
        </label>
        {dongAvailable ? (
          <label>
            <input
              type="radio"
              name="amend-transport"
              checked={kind === "no_car_dong"}
              onChange={() => setKind("no_car_dong")}
            />
            {t("noCarDong")}
          </label>
        ) : null}
        {sharedCarsMode || allowPersonalCar ? (
          <label>
            <input
              type="radio"
              name="amend-transport"
              checked={kind === "no_car_acquaintance"}
              onChange={() => setKind("no_car_acquaintance")}
            />
            {t("noCarAcquaintance")}
          </label>
        ) : null}
      </fieldset>
      {kind === "personal_car" ? (
        <label>
          {t("occupants")}
          <select
            value={occupants}
            onChange={(event) => setOccupants(Number(event.target.value) as 1 | 2 | 3)}
          >
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
          </select>
        </label>
      ) : null}
      <button type="button" disabled={phase === "saving"} onClick={() => void save()}>
        {phase === "saving" ? t("saving") : t("save")}
      </button>
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
