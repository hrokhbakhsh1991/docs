"use client";

import { useCallback, useMemo, useState, type ComponentType } from "react";
import { Button, FormField, Input } from "@tour/ui";

import type { QuickAddFormProps } from "@/components/shared/quick-add/types";
import { useQuickAddModal } from "@/components/shared/QuickAddModal";
import {
  denaliImageFileAssetSchema,
  type DenaliFileAsset,
} from "@/features/tours/wizard/schemas/denaliFileAssetSchema";

export type UploadAssetRow = {
  id: string;
  url: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: string;
  assetId?: string;
  uploadStatus?: "pending" | "uploading" | "uploaded" | "failed";
};

type FileUploadFieldProps = {
  label: string;
  hint?: string;
  error?: string;
  value: UploadAssetRow[] | undefined;
  onChange: (next: UploadAssetRow[] | undefined) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles: number;
  dataTestId?: string;
  metadataQuickAdd?: {
    title: string;
    description?: string;
    entityType: string;
    formComponent: ComponentType<QuickAddFormProps<Partial<DenaliFileAsset>>>;
  };
};

export function FileUploadField({
  label,
  hint,
  error,
  value,
  onChange,
  accept = "image/jpeg, image/png, image/webp",
  multiple = true,
  maxFiles,
  dataTestId,
  metadataQuickAdd,
}: FileUploadFieldProps) {
  const rows = value ?? [];
  const [localError, setLocalError] = useState<string | null>(null);
  const quickAdd = useQuickAddModal();
  const atLimit = rows.length >= maxFiles;

  const resolveError = useMemo(() => error ?? localError ?? undefined, [error, localError]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const parsed = Array.from(files).map((file) =>
        denaliImageFileAssetSchema.safeParse({
          id: crypto.randomUUID(),
          url: URL.createObjectURL(file),
          filename: file.name,
          size: file.size,
          mimeType: file.type,
          uploadedAt: new Date().toISOString(),
          uploadStatus: "pending",
        }),
      );
      const firstError = parsed.find((p) => !p.success);
      if (firstError && !firstError.success) {
        setLocalError(firstError.error.issues[0]?.message ?? "فایل نامعتبر است.");
        e.target.value = "";
        return;
      }
      const nextRows = parsed
        .filter((p): p is Extract<typeof p, { success: true }> => p.success)
        .map((p) => p.data);

      const slots = Math.max(0, maxFiles - rows.length);
      const merged = [...rows, ...nextRows.slice(0, slots)];
      onChange(merged.length > 0 ? merged : undefined);
      setLocalError(null);
      e.target.value = "";
    },
    [maxFiles, onChange, rows],
  );

  const openMetadataQuickAdd = useCallback(() => {
    if (!metadataQuickAdd || rows.length === 0) return;
    const last = rows[rows.length - 1];
    if (!last) return;
    quickAdd.open({
      entityType: metadataQuickAdd.entityType,
      title: metadataQuickAdd.title,
      description: metadataQuickAdd.description,
      formComponent: metadataQuickAdd.formComponent,
      persistWizardState: true,
      onSuccess: (meta) => {
        const next = [...rows];
        next[next.length - 1] = { ...last, ...meta };
        onChange(next);
      },
    });
  }, [metadataQuickAdd, onChange, quickAdd, rows]);

  return (
    <div data-testid={dataTestId}>
      <FormField label={label} description={hint} error={resolveError}>
        <Input
          type="file"
          multiple={multiple}
          accept={accept}
          disabled={atLimit}
          onChange={handleFileChange}
        />
      </FormField>

      {metadataQuickAdd && rows.length > 0 ? (
        <Button type="button" variant="secondary" size="sm" onClick={openMetadataQuickAdd}>
          افزودن متادیتا به آخرین فایل
        </Button>
      ) : null}
    </div>
  );
}
