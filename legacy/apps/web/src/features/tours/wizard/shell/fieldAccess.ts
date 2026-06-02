"use client";

import { useFormContext, useWatch, type FieldValues } from "react-hook-form";

/** Walks a dot-separated path against an arbitrary form values object. */
export function readFormValueAtPath(formValues: unknown, fieldPath: string): unknown {
  if (fieldPath === "") {
    return undefined;
  }
  const segments = fieldPath.split(".");
  let current: unknown = formValues;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/** Subscribes to a single mapped field path — not the full form tree. */
export function useLayoutFieldValue(fieldPath: string): unknown {
  const { control, getValues } = useFormContext<FieldValues>();

  const watched = useWatch({
    control,
    name: fieldPath,
    disabled: fieldPath === "",
  });

  if (fieldPath === "") {
    return undefined;
  }

  if (watched !== undefined) {
    return watched;
  }

  return readFormValueAtPath(getValues(), fieldPath);
}
