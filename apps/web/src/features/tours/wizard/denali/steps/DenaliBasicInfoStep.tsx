"use client";

import {
  DENALI_EVENT_VARIANT_VALUES,
  DENALI_TOUR_CATEGORY_VALUES,
  DENALI_TOUR_DURATION_VALUES,
  type DenaliEventVariant,
  type DenaliTourCategory,
  type DenaliTourDuration,
} from "@repo/types";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button, Checkbox, FormField, Input, Select } from "@tour/ui";

import { DestinationCombobox } from "@/components/tours/wizard/steps/DestinationCombobox";
import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import { useWorkspaceTourCrewMembers } from "@/hooks/use-workspace-tour-crew-members";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import { useDenaliDraftRecovery } from "../DenaliDraftRecoveryContext";
import { DenaliApproximateReturnTimeField } from "../DenaliApproximateReturnTimeField";
import { DenaliDatetimeField } from "../DenaliDatetimeField";

export function DenaliBasicInfoStep() {
  const t = useTranslations("tours.denali");
  const {
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();

  const { canonicalModel, basicsSelection, ui, updateCanonical, updateCanonicalBasics, resetWizard } =
    useDenaliCanonical();

  const { hasRecoverableDraft, recoverDraft } = useDenaliDraftRecovery();

  const showEventVariant = basicsSelection?.category === "event";
  const showEndDateTime = ui.isVisible("denali_basic", "endDateTime");

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

  const activeDestinations = destinationsQuery.groupedRegions.flatMap((group) =>
    group.items.map((item) => ({
      id: item.id,
      name: item.name,
      regionId: group.regionId,
      regionName: group.regionName,
    })),
  );

  return (
    <div style={{ display: "grid", gap: "0.85rem" }} data-testid="denali-step-basics">
      {hasRecoverableDraft ? (
        <div
          data-testid="denali-draft-recovery-banner"
          style={{
            padding: "0.75rem",
            background: "var(--color-primary-50, #eff6ff)",
            border: "1px solid var(--color-primary-200, #bfdbfe)",
            borderRadius: "0.5rem",
            fontSize: "0.9rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>{t("basic.draftRecoveryNotice")}</span>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={recoverDraft}
            data-testid="denali-draft-recovery-action"
          >
            {t("basic.draftRecoveryAction")}
          </Button>
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={resetWizard}
          style={{ color: "var(--color-danger-600, #dc2626)", padding: 0 }}
          data-testid="denali-wizard-clear-draft-top"
        >
          پاک کردن پیش‌نویس
        </Button>
      </div>

      <FormField label={t("basic.title")} error={errors.basicInfo?.title?.message}>
        <Input
          type="text"
          placeholder={t("basic.titlePlaceholder")}
          aria-invalid={Boolean(errors.basicInfo?.title)}
          value={canonicalModel.title}
          onChange={(e) => updateCanonical({ title: e.target.value })}
        />
      </FormField>

      <FormField label={t("basic.categoryLabel")} error={errors.basicInfo?.tourType?.message}>
        <Select
          value={basicsSelection?.category ?? ""}
          onChange={(e) => updateCanonicalBasics({ category: e.target.value as DenaliTourCategory })}
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

      <FormField label={t("basic.durationLabel")} error={errors.basicInfo?.tourType?.message}>
        <Select
          value={basicsSelection?.duration ?? ""}
          onChange={(e) => updateCanonicalBasics({ duration: e.target.value as DenaliTourDuration })}
          data-testid="denali-basics-duration"
          invalid={Boolean(errors.basicInfo?.tourType)}
        >
          <option value="">{t("selectPlaceholder")}</option>
          {DENALI_TOUR_DURATION_VALUES.map((duration) => {
            const category = basicsSelection?.category;
            const disabled = category != null && !ui.isDurationAllowed(duration);
            return (
              <option key={duration} value={duration} disabled={disabled}>
                {t(`basic.durations.${duration}`)}
              </option>
            );
          })}
        </Select>
      </FormField>

      {showEventVariant ? (
        <FormField label={t("basic.eventVariantLabel")} error={errors.basicInfo?.tourType?.message}>
          <Select
            value={basicsSelection?.eventVariant ?? ""}
            onChange={(e) =>
              updateCanonicalBasics({ eventVariant: e.target.value as DenaliEventVariant })
            }
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

      <DestinationCombobox
        label={t("basic.destination")}
        placeholder={t("basic.destinationPlaceholder")}
        options={activeDestinations}
        value={canonicalModel.destinationId}
        onChange={(id) => updateCanonical({ destinationId: typeof id === "string" ? id : "" })}
        error={errors.basicInfo?.destinationId?.message}
      />

      <DestinationCombobox
        label={t("basic.workspaceLeaders")}
        placeholder={t("basic.workspaceLeadersPlaceholder")}
        options={leaderOptions}
        multiple
        value={canonicalModel.leaderUserIds ?? []}
        onChange={(ids) =>
          updateCanonical({
            leaderUserIds: Array.isArray(ids) ? ids : ids ? [ids] : [],
          })
        }
        error={errors.basicInfo?.leaderUserIds?.message}
      />

      <Checkbox
        label={t("basic.requiresLocalGuide")}
        checked={canonicalModel.requiresLocalGuide === true}
        onChange={(e) => {
          const checked = e.target.checked;
          updateCanonical({
            requiresLocalGuide: checked,
            localGuideName: checked ? canonicalModel.localGuideName : undefined,
          });
        }}
        data-testid="denali-basics-requires-local-guide"
      />

      {canonicalModel.requiresLocalGuide === true ? (
        <FormField
          label={t("basic.localGuideName")}
          error={errors.basicInfo?.localGuideName?.message}
        >
          <Input
            type="text"
            placeholder={t("basic.localGuideNamePlaceholder")}
            value={canonicalModel.localGuideName ?? ""}
            onChange={(e) =>
              updateCanonical({
                requiresLocalGuide: true,
                localGuideName: e.target.value || undefined,
              })
            }
            data-testid="denali-basics-local-guide-name"
          />
        </FormField>
      ) : null}

      <DenaliDatetimeField field="startDateTime" label={t("basic.startDateTime")} />

      {showEndDateTime ? (
        <DenaliDatetimeField field="endDateTime" label={t("basic.endDateTime")} />
      ) : null}

      <FormField label={t("basic.capacityMax")} error={errors.basicInfo?.capacityMax?.message}>
        <PersianNumberInput
          numericMode="integer"
          value={canonicalModel.capacityMax ?? ""}
          onChange={(v) =>
            updateCanonical({ capacityMax: v === "" ? undefined : Number(v) })
          }
        />
      </FormField>

      <FormField label={t("basic.capacityMin")} error={errors.basicInfo?.capacityMin?.message}>
        <PersianNumberInput
          numericMode="integer"
          value={canonicalModel.capacityMin ?? ""}
          onChange={(v) =>
            updateCanonical({ capacityMin: v === "" ? undefined : Number(v) })
          }
        />
      </FormField>

      <DenaliApproximateReturnTimeField label={t("basic.approximateReturnTime")} />

      <FormField label="لینک یا آیدی شبکه اجتماعی برنامه" error={errors.basicInfo?.socialMediaLink?.message}>
        <Input
          type="text"
          placeholder="مثلاً t.me/tour_group یا @tour_admin"
          value={canonicalModel.socialMediaLink ?? ""}
          onChange={(e) => updateCanonical({ socialMediaLink: e.target.value || undefined })}
          data-testid="denali-basics-social-media-link"
        />
      </FormField>

      <FormField label={t("basic.meetingPoint")} error={errors.basicInfo?.meetingPoint?.message}>
        <Input
          type="text"
          placeholder={t("basic.meetingPointPlaceholder")}
          value={canonicalModel.meetingPoint ?? ""}
          onChange={(e) => updateCanonical({ meetingPoint: e.target.value || undefined })}
        />
      </FormField>

      <Checkbox
        label={t("basic.requiresManualAdminApproval")}
        checked={canonicalModel.requiresManualAdminApproval === true}
        onChange={(e) =>
          updateCanonical({ requiresManualAdminApproval: e.target.checked })
        }
        data-testid="denali-basics-manual-admin-approval"
      />
    </div>
  );
}