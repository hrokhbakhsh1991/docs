"use client";

import { useEffect } from "react";
import { Button, Input } from "@tour/ui";
import { Controller, type Control, type FieldPath } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliLogistics.schema";

import type { DenaliCustomServiceLabelsPath } from "../denaliCustomServiceLabelsPath";
import styles from "./DenaliCustomServicesEditor.module.css";

export function DenaliCustomServicesEditor({
  control,
  name,
  fields,
  onAppend,
  onRemove,
}: {
  control: Control<DenaliCreateTourWizardForm>;
  name: DenaliCustomServiceLabelsPath;
  fields: ReadonlyArray<{ id: string }>;
  onAppend: (_label: string) => void;
  onRemove: (_index: number) => void;
}) {
  useEffect(() => {
    if (fields.length === 0) {
      onAppend("");
    }
  }, [fields.length, onAppend]);

  return (
    <div className={styles.block} data-testid="denali-custom-services">
      <label className={styles.label}>سرویس‌های انتخابی (سفارشی)</label>
      {fields.length > 0 ? (
        <ul className={styles.list}>
          {fields.map((field, index) => (
            <li key={field.id} className={styles.listItem}>
              <Controller
                control={control}
                name={`${name}.${index}` as FieldPath<DenaliCreateTourWizardForm>}
                render={({ field: rowField }) => (
                  <Input
                    type="text"
                    placeholder="مثلاً: نیسان، صبحانه"
                    value={typeof rowField.value === "string" ? rowField.value : ""}
                    onChange={(event) => rowField.onChange(event.currentTarget.value)}
                    onBlur={rowField.onBlur}
                    ref={rowField.ref}
                    data-testid={`denali-custom-service-input-${index}`}
                  />
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(index)}
                data-testid={`denali-custom-service-remove-${index}`}
              >
                حذف
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.addRow}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => onAppend("")}
          data-testid="denali-custom-service-add"
        >
          افزودن
        </Button>
      </div>
    </div>
  );
}
