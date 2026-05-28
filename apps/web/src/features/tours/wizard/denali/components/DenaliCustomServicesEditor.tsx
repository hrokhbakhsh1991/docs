"use client";

import { useCallback, useState } from "react";
import { Button, Input } from "@tour/ui";

import styles from "./DenaliCustomServicesEditor.module.css";

export function DenaliCustomServicesEditor({
  fields,
  labels,
  onAppend,
  onRemove,
}: {
  fields: ReadonlyArray<{ id: string }>;
  labels: readonly string[];
  onAppend: (_label: string) => void;
  onRemove: (_index: number) => void;
}) {
  const [draft, setDraft] = useState("");

  const addService = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      return;
    }
    onAppend(trimmed);
    setDraft("");
  }, [draft, onAppend]);

  return (
    <div className={styles.block} data-testid="denali-custom-services">
      <label className={styles.label}>سرویس‌های انتخابی (سفارشی)</label>
      {fields.length > 0 ? (
        <ul className={styles.list}>
          {fields.map((field, index) => (
            <li key={field.id} className={styles.listItem}>
              <span>{labels[index] ?? ""}</span>
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
        <Input
          type="text"
          placeholder="مثلاً: نیسان، صبحانه"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addService();
            }
          }}
          onBlur={addService}
          data-testid="denali-custom-service-input"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addService}
          disabled={draft.trim() === ""}
          data-testid="denali-custom-service-add"
        >
          افزودن
        </Button>
      </div>
    </div>
  );
}
