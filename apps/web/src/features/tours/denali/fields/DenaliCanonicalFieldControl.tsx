"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Checkbox, FormField, Input, Textarea } from "@tour/ui";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import type { DenaliCanonicalTourModel } from "@repo/types/denali";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { resolveDenaliRegistryFieldLabel } from "@/features/tours/wizard/denali/denaliRegistryFieldLabel";
import {
  buildDenaliCanonicalPartialFromPath,
} from "@/features/tours/wizard/denali/denaliCanonicalPathUtils";

import { useDenaliCanonical, useDenaliCanonicalValue } from "@/features/tours/wizard/denali/application";

import type { DenaliZodKindFieldProps } from "./denaliZodKindFieldProps";

function fieldError(
  errors: DenaliCreateTourWizardForm | Record<string, unknown>,
  rhfPath: string,
): string | undefined {
  const segments = rhfPath.split(".");
  let current: unknown = errors;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  if (current != null && typeof current === "object" && "message" in current) {
    const message = (current as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

function patchField(
  updateCanonical: ReturnType<typeof useDenaliCanonical>["updateCanonical"],
  canonicalPath: string,
  value: unknown,
) {
  updateCanonical(buildDenaliCanonicalPartialFromPath(canonicalPath, value));
}

/** Canonical-path control for scalar registry fields (flat edit + renderer). */
export function DenaliCanonicalFieldControl({ field, required }: DenaliZodKindFieldProps) {
  const t = useTranslations("tours.denali");
  const {
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();
  const { updateCanonical } = useDenaliCanonical();
  const label = resolveDenaliRegistryFieldLabel(field.rhfPath, t);
  const error = fieldError(errors as Record<string, unknown>, field.rhfPath);
  const value = useDenaliCanonicalValue<unknown>(field.canonicalPath);
  const transport = useDenaliCanonicalValue<DenaliCanonicalTourModel["transport"]>("transport");
  const pricing = useDenaliCanonicalValue<DenaliCanonicalTourModel["pricing"]>("pricing");
  const program = useDenaliCanonicalValue<DenaliCanonicalTourModel["program"]>("program");
  const policies = useDenaliCanonicalValue<DenaliCanonicalTourModel["policies"]>("policies");
  const localGuideName = useDenaliCanonicalValue<string | undefined>("localGuideName");

  const dataTestId = `denali-field-${field.canonicalPath.replace(/\./g, "-")}`;
  const path = field.canonicalPath;

  if (path === "requiresLocalGuide") {
    return (
      <FormField label={label} error={error}>
        <Checkbox
          label={t("basic.requiresLocalGuide")}
          checked={value === true}
          onChange={(e) => {
            const checked = e.target.checked;
            updateCanonical({
              requiresLocalGuide: checked,
              localGuideName: checked ? localGuideName : undefined,
            });
          }}
          data-testid="denali-basics-requires-local-guide"
        />
      </FormField>
    );
  }

  if (path === "localGuideName") {
    return (
      <FormField label={label} error={error}>
        <Input
          type="text"
          placeholder={t("basic.localGuideNamePlaceholder")}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => {
            updateCanonical({
              requiresLocalGuide: true,
              localGuideName: e.target.value || undefined,
            });
          }}
          data-testid="denali-basics-local-guide-name"
        />
      </FormField>
    );
  }

  if (path === "requiresManualAdminApproval") {
    return (
      <Checkbox
        label={t("basic.requiresManualAdminApproval")}
        checked={value === true}
        onChange={(e) => updateCanonical({ requiresManualAdminApproval: e.target.checked })}
        data-testid="denali-basics-manual-admin-approval"
      />
    );
  }

  if (path === "socialMediaLink") {
    return (
      <FormField label="لینک یا آیدی شبکه اجتماعی برنامه" error={error}>
        <Input
          type="text"
          placeholder="مثلاً t.me/tour_group یا @tour_admin"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => patchField(updateCanonical, path, e.target.value || undefined)}
          data-testid="denali-basics-social-media-link"
        />
      </FormField>
    );
  }

  if (path === "pricing.requiresPayment") {
    return (
      <Checkbox
        label={t("pricing.requiresPayment")}
        checked={pricing.requiresPayment === true}
        onChange={(e) => {
          const checked = e.target.checked;
          updateCanonical({
            pricing: {
              ...pricing,
              requiresPayment: checked ? true : undefined,
              basePricePerPerson: checked ? pricing.basePricePerPerson : undefined,
            },
          });
        }}
        data-testid="denali-pricing-requires-payment"
      />
    );
  }

  if (path === "pricing.basePricePerPerson") {
    return (
      <FormField
        label={t("pricing.basePricePerPerson")}
        description={t("pricing.basePricePerPersonHint")}
        error={errors.pricingPayment?.basePricePerPerson?.message}
      >
        <PersianNumberInput
          numericMode="integer"
          formatThousands
          value={pricing.basePricePerPerson ?? ""}
          onChange={(v) =>
            updateCanonical({
              pricing: {
                ...pricing,
                requiresPayment: true,
                basePricePerPerson: v === "" ? undefined : Number(v),
              },
            })
          }
          data-testid="denali-pricing-base-price"
        />
      </FormField>
    );
  }

  if (path === "pricing.includesTourInsurance") {
    return (
      <Checkbox
        label={t("pricing.includesTourInsurance")}
        checked={pricing.includesTourInsurance === true}
        onChange={(e) =>
          updateCanonical({
            pricing: {
              ...pricing,
              includesTourInsurance: e.target.checked,
            },
          })
        }
        data-testid="denali-pricing-tour-insurance"
        data-field-path="pricingPayment.includesTourInsurance"
      />
    );
  }

  if (path === "transport.transportCost") {
    return (
      <FormField label={label} error={error}>
        <PersianNumberInput
          numericMode="integer"
          formatThousands
          value={transport.transportCost ?? ""}
          onChange={(v) =>
            updateCanonical({
              transport: {
                ...transport,
                transportCost: v === "" ? undefined : Number(v),
              },
            })
          }
          data-testid="denali-transport-cost"
          data-field-path="transport.transportCost"
        />
      </FormField>
    );
  }

  if (path === "transport.allowPersonalCar") {
    return (
      <Checkbox
        checked={transport.allowPersonalCar === true}
        onChange={(e) => {
          const checked = e.target.checked;
          updateCanonical({
            transport: {
              ...transport,
              allowPersonalCar: checked ? true : undefined,
              dongAmount: checked ? transport.dongAmount : undefined,
              adminCapacityApproval: checked ? transport.adminCapacityApproval : undefined,
            },
          });
        }}
        label={t("transport.allowPersonalCar")}
        data-testid="denali-transport-allow-personal-car"
        data-field-path="transport.allowPersonalCar"
      />
    );
  }

  if (path === "transport.dongAmount") {
    return (
      <FormField label={label} error={error}>
        <PersianNumberInput
          numericMode="integer"
          formatThousands
          value={transport.dongAmount ?? ""}
          onChange={(v) =>
            updateCanonical({
              transport: {
                ...transport,
                dongAmount: v === "" ? undefined : Number(v),
              },
            })
          }
          data-testid="denali-transport-dong-amount"
          data-field-path="transport.dongAmount"
        />
      </FormField>
    );
  }

  if (path === "transport.adminCapacityApproval") {
    return (
      <Checkbox
        checked={transport.adminCapacityApproval === true}
        onChange={(e) => {
          const checked = e.target.checked;
          updateCanonical({
            transport: {
              ...transport,
              adminCapacityApproval: checked ? true : undefined,
            },
          });
        }}
        label={t("transport.adminCapacityApproval")}
        data-testid="denali-transport-admin-capacity-approval"
        data-field-path="transport.adminCapacityApproval"
      />
    );
  }

  if (path === "program.hikingHoursApprox") {
    return (
      <FormField label={label} error={error} required={required}>
        <PersianNumberInput
          numericMode="integer"
          value={program.hikingHoursApprox ?? ""}
          onChange={(v) =>
            updateCanonical({
              program: {
                ...program,
                hikingHoursApprox: v === "" ? undefined : Number(v),
              },
            })
          }
          data-testid="denali-program-hiking-hours"
        />
      </FormField>
    );
  }

  if (path === "program.hikingGoHours" || path === "program.hikingReturnHours") {
    const key = path === "program.hikingGoHours" ? "hikingGoHours" : "hikingReturnHours";
    const testId =
      path === "program.hikingGoHours"
        ? "denali-program-hiking-go-hours"
        : "denali-program-hiking-return-hours";
    return (
      <FormField label={label} error={error} required={required}>
        <PersianNumberInput
          numericMode="integer"
          value={program[key] ?? ""}
          onChange={(v) =>
            updateCanonical({
              program: {
                ...program,
                [key]: v === "" ? undefined : Number(v),
              },
            })
          }
          data-testid={testId}
        />
      </FormField>
    );
  }

  if (path === "policies.policiesText") {
    return (
      <FormField label={t("policies.notes")} error={error}>
        <Textarea
          rows={4}
          placeholder={t("policies.notesPlaceholder")}
          data-testid="denali-legal-policies-notes"
          data-field-path="policies.policiesText"
          value={policies.policiesText ?? ""}
          onChange={(e) =>
            updateCanonical({
              policies: {
                ...policies,
                policiesText: e.target.value || undefined,
              },
            })
          }
        />
      </FormField>
    );
  }

  if (path === "policies.cancellationDeadlineHours" || path === "policies.cancellationPenaltyPercentage") {
    const key =
      path === "policies.cancellationDeadlineHours"
        ? "cancellationDeadlineHours"
        : "cancellationPenaltyPercentage";
    const testId =
      path === "policies.cancellationDeadlineHours"
        ? "denali-legal-cancellation-hours"
        : "denali-legal-cancellation-penalty";
    return (
      <FormField label={label} error={error}>
        <PersianNumberInput
          numericMode="integer"
          value={policies[key] ?? ""}
          onChange={(v) =>
            updateCanonical({
              policies: {
                ...policies,
                [key]: v === "" ? undefined : Number(v),
              },
            })
          }
          data-testid={testId}
          data-field-path={path}
        />
      </FormField>
    );
  }

  if (path === "tripDetails.overview.peakHeight") {
    return (
      <FormField
        label={t("basic.peakHeight")}
        description={t("basic.peakHeightDescription")}
        error={errors.tripDetails?.overview?.peakHeight?.message}
        required={required}
      >
        <PersianNumberInput
          numericMode="integer"
          formatThousands
          value={typeof value === "number" ? value : ""}
          onChange={(v) => patchField(updateCanonical, path, v === "" ? undefined : Number(v))}
          data-testid="denali-basic-peak-height"
          data-field-path="tripDetails.overview.peakHeight"
        />
      </FormField>
    );
  }

  if (path === "tripDetails.overview.nonAttendanceDetails") {
    return (
      <FormField label={t("pricing.nonAttendanceDetails")} error={error}>
        <Textarea
          rows={3}
          placeholder={t("pricing.nonAttendanceDetailsPlaceholder")}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => patchField(updateCanonical, path, e.target.value.trim() === "" ? undefined : e.target.value)}
          data-testid="denali-non-attendance-details"
          data-field-path="tripDetails.overview.nonAttendanceDetails"
        />
      </FormField>
    );
  }

  if (field.zodKind === "booleanOptional") {
    return (
      <FormField label={label} error={error}>
        <Checkbox
          checked={value === true}
          onChange={(e) => patchField(updateCanonical, path, e.target.checked ? true : undefined)}
          data-testid={dataTestId}
        />
      </FormField>
    );
  }

  if (
    field.zodKind === "optionalInt" ||
    field.zodKind === "optionalPositiveInt" ||
    field.zodKind === "capacityMax"
  ) {
    return (
      <FormField label={label} error={error} required={required}>
        <PersianNumberInput
          numericMode="integer"
          formatThousands={field.zodKind === "capacityMax"}
          value={typeof value === "number" ? value : ""}
          onChange={(v) => patchField(updateCanonical, path, v === "" ? undefined : Number(v))}
          data-testid={dataTestId}
          data-field-path={field.rhfPath}
        />
      </FormField>
    );
  }

  if (field.zodKind === "title" || field.zodKind === "stringOptional") {
    return (
      <FormField label={label} error={error} required={required}>
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => {
            const next = e.target.value;
            if (path === "title") {
              updateCanonical({ title: next });
            } else {
              patchField(updateCanonical, path, next || undefined);
            }
          }}
          data-testid={dataTestId}
          data-field-path={field.rhfPath}
        />
      </FormField>
    );
  }

  return null;
}
