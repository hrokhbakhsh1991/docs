"use client";

import { Controller, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { Checkbox, FormField } from "@tour/ui";

import { DestinationCombobox } from "@/components/tours/wizard/steps/DestinationCombobox";
import { useWorkspaceTourCrewMembers } from "@/hooks/use-workspace-tour-crew-members";

import { DENALI_FIELD_HINTS, denaliFieldHintStyle } from "@/features/tours/wizard/denali/denaliFieldHints";

import type { TourFormInput } from "./tour-schema";

import styles from "./TourForm.module.css";

export type TourEditLeadersParticipationSectionProps = {
  disabled?: boolean;
};

export function TourEditLeadersParticipationSection({
  disabled = false,
}: TourEditLeadersParticipationSectionProps) {
  const tDenali = useTranslations("tours.denali");
  const tSettings = useTranslations("settings");
  const {
    control,
    formState: { errors },
  } = useFormContext<TourFormInput>();

  const crewMembersQuery = useWorkspaceTourCrewMembers();

  const crewRoleLabel = (role: string) => {
    if (role === "owner") return tDenali("basic.crewRoles.owner");
    if (role === "admin") return tDenali("basic.crewRoles.admin");
    if (role === "leader") return tDenali("basic.crewRoles.leader");
    return role;
  };

  const rewardBadgeLabels: Record<string, string> = {
    VIP_MEMBER: "عضو VIP",
    GOLD_CLUB: "طلایی",
  };

  const leaderOptions = (crewMembersQuery.data ?? []).map((member) => ({
    id: member.id,
    name: member.name?.trim() || member.email || member.phone || member.id,
    regionId: member.role,
    regionName: crewRoleLabel(member.role),
    badges: (member.rewardBadges ?? [])
      .map((id) => rewardBadgeLabels[id])
      .filter((label): label is string => Boolean(label)),
  }));

  const overviewErrors = errors.tripDetails?.overview as
    | { leaderUserIds?: { message?: string } }
    | undefined;
  const participationErrors = errors.tripDetails?.participation as
    | {
        sportsInsuranceRequired?: { message?: string };
        registrationNationalIdRequired?: { message?: string };
      }
    | undefined;

  return (
    <section className={styles.leadersParticipationSection} aria-labelledby="tour-edit-leaders-heading">
      <h3 id="tour-edit-leaders-heading" className={styles.sectionHeading}>
        راهنما و لیدرهای تور
      </h3>
      <div className={styles.leadersParticipationFields}>
        <Controller
          control={control}
          name="tripDetails.overview.leaderUserIds"
          render={({ field }) => (
            <DestinationCombobox
              label={tDenali("basic.workspaceLeaders")}
              placeholder={tDenali("basic.workspaceLeadersPlaceholder")}
              options={leaderOptions}
              multiple
              value={Array.isArray(field.value) ? field.value : []}
              onChange={(ids) =>
                field.onChange(Array.isArray(ids) ? ids : ids ? [ids] : [])
              }
              error={overviewErrors?.leaderUserIds?.message}
            />
          )}
        />

        <p style={denaliFieldHintStyle} dir="rtl">
          {DENALI_FIELD_HINTS.insuranceAndNationalId}
        </p>

        <Controller
          control={control}
          name="tripDetails.participation.registrationNationalIdRequired"
          render={({ field }) => (
            <FormField
              label={tDenali("participants.nationalIdRequired")}
              error={participationErrors?.registrationNationalIdRequired?.message}
            >
              <Checkbox
                label={tDenali("participants.nationalIdRequired")}
                checked={field.value === true}
                disabled={disabled}
                onChange={(e) => field.onChange(e.target.checked ? true : false)}
                data-testid="tour-edit-national-id-required"
              />
            </FormField>
          )}
        />

        <Controller
          control={control}
          name="tripDetails.participation.sportsInsuranceRequired"
          render={({ field }) => (
            <FormField
              label={tSettings("tourFormDefaults_participation_sportsInsurance")}
              error={participationErrors?.sportsInsuranceRequired?.message}
            >
              <Checkbox
                label={tSettings("tourFormDefaults_participation_sportsInsuranceCheckbox")}
                checked={field.value === true}
                disabled={disabled}
                onChange={(e) => field.onChange(e.target.checked ? true : false)}
                data-testid="tour-edit-sports-insurance-required"
              />
            </FormField>
          )}
        />
      </div>
    </section>
  );
}
