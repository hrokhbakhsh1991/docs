import type { ComponentType, ReactNode } from "react";
import type { z } from "zod";

/** Known catalog entities; extend with string for custom quick-add flows. */
export type QuickAddEntityType = "destination" | "equipment" | (string & {});

export type QuickAddFormProps<TEntity> = {
  /** Call only after the create API succeeds — closes the modal via provider. */
  onSuccess: (_entity: TEntity) => void;
  onCancel: () => void;
  isPending: boolean;
  /** Surface API/validation failures inside the modal (modal stays open). */
  setError: (_message: string | null) => void;
  /** Blocks scrim/Escape close while the inner form is submitting. */
  setPending: (_pending: boolean) => void;
};

/** Arguments to `useQuickAddModal().open(props)`. */
export type QuickAddModalOpenProps<TEntity = unknown> = QuickAddModalConfig<TEntity>;

export type QuickAddModalConfig<TEntity = unknown> = {
  entityType: QuickAddEntityType;
  title: ReactNode;
  description?: ReactNode;
  /** Optional Zod schema for future client-side guards / telemetry. */
  schema?: z.ZodType;
  formComponent: ComponentType<QuickAddFormProps<TEntity>>;
  /**
   * Bridge after successful create: update react-hook-form and CanonicalContext here.
   * Modal closes only when the inner form calls through to this callback (not on API error).
   */
  onSuccess: (_entity: TEntity) => void;
  onClose?: () => void;
};
