"use client";

import { NewlineArrayTextareaField } from "../primitives/NewlineArrayTextareaField";

/**
 * Newline-array list fields under `logistics.*`:
 *   - `logistics.supportServices`
 *   - `logistics.optionalServices`
 *
 * Behavior parity: identical placeholders, labels, descriptions, and 2-row textarea height as the
 * previous `LogisticsStep.tsx` inline JSX.
 */
export function LogisticsServiceListFields() {
  return (
    <>
      <NewlineArrayTextareaField
        name="logistics.supportServices"
        label="خدمات پشتیبانی (هر مورد در یک خط)"
        description="امکاناتی که تیم اجرا در طول تور فراهم می‌کند؛ هر خط یک مورد."
        rows={2}
        placeholder={"راهنمای محلی\nراهنمای فنی صعود\nکیت کمک‌های اولیه پایه"}
      />

      <NewlineArrayTextareaField
        name="logistics.optionalServices"
        label="خدمات اختیاری (هر مورد در یک خط)"
        description="افزونه‌هایی با هزینهٔ جدا یا رزرو جدا که می‌توان به تور اضافه کرد."
        rows={2}
        placeholder={"اجاره باتوم\nاجاره کیسه‌خواب\nحمل بار با قاطر (با هماهنگی قبلی)"}
      />
    </>
  );
}
