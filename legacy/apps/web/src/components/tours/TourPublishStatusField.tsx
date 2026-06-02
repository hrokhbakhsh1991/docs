"use client";

import type { TourFormLifecycleStatus } from "./tour-lifecycle";

import styles from "./TourPublishStatusField.module.css";

export type TourPublishStatusValue = TourFormLifecycleStatus;

type TourPublishStatusFieldProps = {
  value: TourPublishStatusValue;
  onChange: (_next: TourPublishStatusValue) => void;
  disabled?: boolean;
  /** Individual segment values that cannot be selected (e.g. OPEN blocked until publish-ready). */
  disableValues?: readonly TourPublishStatusValue[];
  /** When false, archived option is hidden (create flow). */
  allowArchived?: boolean;
  "data-testid"?: string;
};

const OPTIONS: Array<{
  value: TourPublishStatusValue;
  title: string;
  description: string;
}> = [
  {
    value: "draft",
    title: "پیش‌نویس",
    description: "تور برای مسافران نمایش داده نمی‌شود؛ می‌توانید بعداً منتشر کنید.",
  },
  {
    value: "active",
    title: "منتشرشده (فعال)",
    description: "تور در لیست عمومی قابل مشاهده و ثبت‌نام است (وضعیت OPEN).",
  },
  {
    value: "archived",
    title: "بایگانی",
    description: "تور بسته شده و ثبت‌نام جدید نمی‌پذیرد.",
  },
];

/** Premium segmented control for tour visibility (DRAFT ↔ OPEN). */
export function TourPublishStatusField({
  value,
  onChange,
  disabled = false,
  disableValues,
  allowArchived = true,
  "data-testid": testId = "tour-publish-status",
}: TourPublishStatusFieldProps) {
  const visible = allowArchived ? OPTIONS : OPTIONS.filter((o) => o.value !== "archived");

  return (
    <fieldset className={styles.fieldset} data-testid={testId} dir="rtl">
      <legend className={styles.legend}>وضعیت انتشار تور</legend>
      <p className={styles.intro}>
        انتشار را خودتان مشخص کنید؛ پیش‌نویس امن است تا همه فیلدهای الزامی تکمیل شوند.
      </p>
      <div className={styles.segmentRow} role="radiogroup" aria-label="وضعیت انتشار تور">
        {visible.map((opt) => {
          const selected = value === opt.value;
          const optionDisabled = disabled || disableValues?.includes(opt.value) === true;
          return (
            <label
              key={opt.value}
              className={selected ? `${styles.segment} ${styles.segmentSelected}` : styles.segment}
            >
              <input
                type="radio"
                name="tour-publish-status"
                value={opt.value}
                checked={selected}
                disabled={optionDisabled}
                className={styles.srOnly}
                onChange={() => onChange(opt.value)}
                data-testid={`${testId}-${opt.value}`}
              />
              <span className={styles.segmentTitle}>{opt.title}</span>
              <span className={styles.segmentDescription}>{opt.description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
