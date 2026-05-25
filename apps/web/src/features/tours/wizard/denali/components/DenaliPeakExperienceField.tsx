"use client";

import { FormField, Select } from "@tour/ui";

import { PEAK_EXPERIENCE_MIN_OPTIONS } from "@/features/tours/domain/peak-experience";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { useDenaliCanonical } from "../DenaliCanonicalContext";
import { DENALI_FIELD_HINTS } from "../denaliFieldHints";
import { useDenaliCanonicalValue } from "../hooks/useDenaliCanonicalValue";

/** Peak auto-approval threshold — always shown on Denali create wizard (pricing step). */
export function DenaliPeakExperienceField() {
  const { updateCanonical } = useDenaliCanonical();
  const participants = useDenaliCanonicalValue<DenaliCanonicalTourModel["participants"]>(
    "participants",
  );
  const raw = participants.minRequiredPeaks;
  const selected =
    typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 4
      ? String(raw)
      : "0";

  return (
    <FormField
      label="حداقل قله‌های صعودشده (شرط تایید خودکار)"
      description={DENALI_FIELD_HINTS.minRequiredPeaks}
    >
      <Select
        data-testid="denali-pricing-min-required-peaks"
        value={selected}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          updateCanonical({
            participants: {
              ...participants,
              minRequiredPeaks: Number.isFinite(n) && n > 0 ? n : undefined,
            },
          });
        }}
      >
        {PEAK_EXPERIENCE_MIN_OPTIONS.map((opt) => (
          <option key={opt.value} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}
