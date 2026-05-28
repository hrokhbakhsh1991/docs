"use client";

import {
  DENALI_EVENT_VARIANT_VALUES,
  DENALI_TOUR_CATEGORY_VALUES,
  DENALI_TOUR_DURATION_VALUES,
  type DenaliEventVariant,
  type DenaliTourCategory,
  type DenaliTourDuration,
} from "@repo/types";
import { useController, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button, Checkbox, FormField, Input, Select } from "@tour/ui";

import quickAddStyles from "@/components/shared/quick-add/QuickAddModal.module.css";
import { DestinationCombobox } from "@/components/tours/wizard/steps/DestinationCombobox";
import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { SettingsDestinationDto } from "@/lib/settings-locations-client";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import { useWorkspaceTourCrewMembers } from "@/hooks/use-workspace-tour-crew-members";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import { useDenaliCanonical, useDenaliCanonicalValue, useDenaliDestinationQuickAdd, useDenaliStepFieldRules } from "../application";
import { DenaliApproximateReturnTimeField } from "../DenaliApproximateReturnTimeField";
import { DenaliDatetimeField } from "../DenaliDatetimeField";

const STEP = "denali_basic" as const;
const PATH_PEAK_HEIGHT = "tripDetails.overview.peakHeight";

export function DenaliBasicInfoStep() {
  const t = useTranslations("tours.denali");
  const {
    control,
    getValues,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const peakHeightField = useController({
    control,
    name: "tripDetails.overview.peakHeight",
  });

  const { basicsSelection, updateCanonical, updateCanonicalBasics } = useDenaliCanonical();
  const title = useDenaliCanonicalValue<string>("title");
  const destinationId = useDenaliCanonicalValue<string | undefined>("destinationId");
  const leaderUserIds = useDenaliCanonicalValue<string[]>("leaderUserIds");
  const requiresLocalGuide = useDenaliCanonicalValue<boolean | undefined>("requiresLocalGuide");
  const localGuideName = useDenaliCanonicalValue<string | undefined>("localGuideName");
  const capacityMax = useDenaliCanonicalValue<number | undefined>("capacityMax");
  const capacityMin = useDenaliCanonicalValue<number | undefined>("capacityMin");
  const socialMediaLink = useDenaliCanonicalValue<string | undefined>("socialMediaLink");
  const requiresManualAdminApproval = useDenaliCanonicalValue<boolean | undefined>(
    "requiresManualAdminApproval",
  );

  const form = getValues();
  const { isVisible, isDurationAllowed } = useDenaliStepFieldRules(STEP);
  const openDestinationQuickAdd = useDenaliDestinationQuickAdd();

  const destinationsQuery = useTourDestinations();
  const crewMembersQuery = useWorkspaceTourCrewMembers();
  const crewRoleLabel = (role: string) => {
    if (role === "owner") return t("basic.crewRoles.owner");
    if (role === "admin") return t("basic.crewRoles.admin");
    if (role === "leader") return t("basic.crewRoles.leader");
    return role;
  };
  const leaderOptions = (crewMembersQuery.data ?? []).map((member) => ({
    id: member.id,
    name: String(member.name?.trim() || member.email || member.phone || member.id),
    regionId: member.role,
    regionName: crewRoleLabel(member.role),
  }));

  const destinationById = new Map<string, SettingsDestinationDto>(
    (destinationsQuery.destinations ?? []).map((item) => [item.id, item]),
  );
  const activeDestinations = destinationsQuery.groupedRegions.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      name: item.name,
      regionId: group.regionId,
      regionName: group.regionName,
    })),
  );

  const applyDestinationSelection = (id: string) => {
    updateCanonical({ destinationId: id });
    const altitudeM = destinationById.get(id)?.altitudeM;
    if (typeof altitudeM === "number" && Number.isFinite(altitudeM) && altitudeM > 0) {
      peakHeightField.field.onChange(altitudeM);
      updateCanonical({
        overview: {
          peakHeight: altitudeM,
        },
      });
    }
  };

  return (
    <div style={{ display: "grid", gap: "0.85rem" }} data-testid="denali-step-basics">
      <FormField label={t("basic.categoryLabel")} error={errors.basicInfo?.tourType?.message}>
        <Select
          value={basicsSelection?.category ?? ""}
          onChange={(e) => {
              updateCanonicalBasics({ category: e.target.value as DenaliTourCategory });
          }}
            data-testid="denali-basics-category"
          invalid={Boolean(errors.basicInfo?.tourType)}
        >
          <option value="">{t("selectPlaceholder")}</option>
          {DENALI_TOUR_CATEGORY_VALUES.map((category) => (
            <option key={category} value={category}>
              {t(`basic.categories.${category}`)}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label={t("basic.title")} error={errors.basicInfo?.title?.message}>
        <Input
          type="text"
          placeholder={t("basic.titlePlaceholder")}
          aria-invalid={Boolean(errors.basicInfo?.title)}
          value={title}
          onChange={(e) => {
              updateCanonical({ title: e.target.value });
          }}
          />
      </FormField>

      <FormField label={t("basic.durationLabel")} error={errors.basicInfo?.tourType?.message}>
        <Select
          value={basicsSelection?.duration ?? ""}
          onChange={(e) => {
              updateCanonicalBasics({ duration: e.target.value as DenaliTourDuration });
          }}
            data-testid="denali-basics-duration"
          invalid={Boolean(errors.basicInfo?.tourType)}
        >
          <option value="">{t("selectPlaceholder")}</option>
          {DENALI_TOUR_DURATION_VALUES.map((duration) => {
            const category = basicsSelection?.category;
            const disabled = category != null && !isDurationAllowed(duration);
            return (
              <option key={duration} value={duration} disabled={disabled}>
                {t(`basic.durations.${duration}`)}
              </option>
            );
          })}
        </Select>
      </FormField>

      {isVisible("eventVariant", form) ? (
        <FormField label={t("basic.eventVariantLabel")} error={errors.basicInfo?.tourType?.message}>
          <Select
            value={basicsSelection?.eventVariant ?? ""}
            onChange={(e) => {
                  updateCanonicalBasics({ eventVariant: e.target.value as DenaliEventVariant });
            }}
                data-testid="denali-basics-event-variant"
          >
            {DENALI_EVENT_VARIANT_VALUES.map((variant) => (
              <option key={variant} value={variant}>
                {t(`basic.eventVariants.${variant}`)}
              </option>
            ))}
          </Select>
        </FormField>
      ) : null}

      {isVisible("destinationId", form) ? (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <DestinationCombobox
            label={t("basic.destination")}
            placeholder={t("basic.destinationPlaceholder")}
            options={activeDestinations}
            value={destinationId}
            onChange={(id) => {
                  if (typeof id === "string" && id) {
                applyDestinationSelection(id);
                return;
              }
              updateCanonical({ destinationId: "" });
            }}
            error={errors.basicInfo?.destinationId?.message}
          />
          <div className={quickAddStyles.quickAddRow} dir="rtl">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={openDestinationQuickAdd}
              data-testid="denali-quick-add-destination"
            >
              + مقصد
            </Button>
          </div>
        </div>
      ) : null}

      {isVisible(PATH_PEAK_HEIGHT, form) ? (
        <FormField
          label={t("basic.peakHeight")}
          description={t("basic.peakHeightDescription")}
          error={errors.tripDetails?.overview?.peakHeight?.message}
        >
          <PersianNumberInput
            numericMode="integer"
            formatThousands
            value={peakHeightField.field.value ?? ""}
            onChange={(v) => {
                  const next = v === "" ? undefined : Number(v);
              peakHeightField.field.onChange(next);
              updateCanonical({
                overview: {
                  peakHeight: next,
                },
              });
            }}
            onBlur={peakHeightField.field.onBlur}
            data-testid="denali-basic-peak-height"
            data-field-path={PATH_PEAK_HEIGHT}
          />
        </FormField>
      ) : null}

      {isVisible("leaderUserIds", form) ? (
        <DestinationCombobox
          label={t("basic.workspaceLeaders")}
          placeholder={t("basic.workspaceLeadersPlaceholder")}
          options={leaderOptions}
          multiple
          value={leaderUserIds ?? []}
          onChange={(ids) => {
              updateCanonical({
              leaderUserIds: Array.isArray(ids) ? ids : ids ? [ids] : [],
            });
          }}
          error={errors.basicInfo?.leaderUserIds?.message}
        />
      ) : null}

      {isVisible("requiresLocalGuide", form) ? (
        <Checkbox
          label={t("basic.requiresLocalGuide")}
          checked={requiresLocalGuide === true}
          onChange={(e) => {
              const checked = e.target.checked;
            updateCanonical({
              requiresLocalGuide: checked,
              localGuideName: checked ? localGuideName : undefined,
            });
          }}
          data-testid="denali-basics-requires-local-guide"
        />
      ) : null}

      {isVisible("localGuideName", form) ? (
        <FormField
          label={t("basic.localGuideName")}
          error={errors.basicInfo?.localGuideName?.message}
        >
          <Input
            type="text"
            placeholder={t("basic.localGuideNamePlaceholder")}
            value={localGuideName ?? ""}
            onChange={(e) => {
                  updateCanonical({
                requiresLocalGuide: true,
                localGuideName: e.target.value || undefined,
              });
            }}
                data-testid="denali-basics-local-guide-name"
          />
        </FormField>
      ) : null}

      <DenaliDatetimeField field="startDateTime" label={t("basic.startDateTime")} />

      {isVisible("endDateTime", form) ? (
        <DenaliDatetimeField field="endDateTime" label={t("basic.endDateTime")} />
      ) : null}

      {isVisible("capacityMax", form) ? (
        <FormField
          label={t("basic.capacityMax")}
          error={errors.basicInfo?.capacityMax?.message}
        >
          <PersianNumberInput
            numericMode="integer"
            value={capacityMax ?? ""}
            onChange={(v) => {
                  updateCanonical({ capacityMax: v === "" ? undefined : Number(v) });
            }}
              />
        </FormField>
      ) : null}

      {isVisible("capacityMin", form) ? (
        <FormField label={t("basic.capacityMin")} error={errors.basicInfo?.capacityMin?.message}>
          <PersianNumberInput
            numericMode="integer"
            value={capacityMin ?? ""}
            onChange={(v) => {
                  updateCanonical({ capacityMin: v === "" ? undefined : Number(v) });
            }}
              />
        </FormField>
      ) : null}

      <DenaliApproximateReturnTimeField label={t("basic.approximateReturnTime")} />

      {isVisible("socialMediaLink", form) ? (
        <FormField label="لینک یا آیدی شبکه اجتماعی برنامه" error={errors.basicInfo?.socialMediaLink?.message}>
          <Input
            type="text"
            placeholder="مثلاً t.me/tour_group یا @tour_admin"
            value={socialMediaLink ?? ""}
            onChange={(e) => {
                  updateCanonical({ socialMediaLink: e.target.value || undefined });
            }}
                data-testid="denali-basics-social-media-link"
          />
        </FormField>
      ) : null}

      <Checkbox
        label={t("basic.requiresManualAdminApproval")}
        checked={requiresManualAdminApproval === true}
        onChange={(e) => {
          updateCanonical({ requiresManualAdminApproval: e.target.checked });
        }}
        data-testid="denali-basics-manual-admin-approval"
      />
    </div>
  );
}
