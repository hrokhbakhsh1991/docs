"use client";

/**
 * Universal in-place entity creation modal (Radix Dialog).
 *
 * - Wrap the tree with `QuickAddModalProvider` (optionally `wizardPersistence`).
 * - Call `useQuickAddModal().open({ title, formComponent, onSuccess, ... })`.
 * - Inner forms call `onSuccess` only after API success; errors use `setError` (modal stays open).
 *
 * @see DenaliLogisticsStep — Destination + Equipment examples.
 */

import * as Dialog from "@radix-ui/react-dialog";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import { Alert } from "@tour/ui";

import { DestinationQuickAddForm } from "./quick-add/forms/DestinationQuickAddForm";
import { EquipmentQuickAddForm } from "./quick-add/forms/EquipmentQuickAddForm";
import {
  clearWizardQuickAddGuard,
  persistWizardSnapshotForQuickAdd,
  restoreWizardDraftFromQuickAddGuard,
} from "./quick-add/persistWizardSnapshot";
import type {
  QuickAddFormProps,
  QuickAddModalConfig,
  QuickAddModalOpenProps,
  WizardPersistenceConfig,
} from "./quick-add/types";

import styles from "./quick-add/QuickAddModal.module.css";

export type QuickAddModalViewProps<TEntity = unknown> = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  apiError: string | null;
  /** Rendered as modal body children (typically a thin wrapper around a settings create form). */
  formComponent: ComponentType<QuickAddFormProps<TEntity>>;
  formProps: QuickAddFormProps<TEntity>;
};

/** Radix Dialog shell: title + error banner + `formComponent` children. */
export function QuickAddModal<TEntity = unknown>({
  open,
  onClose,
  title,
  description,
  apiError,
  formComponent: FormComponent,
  formProps,
}: QuickAddModalViewProps<TEntity>) {
  const preventDismiss = formProps.isPending;

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !preventDismiss) {
        onClose();
      }
    },
    [onClose, preventDismiss],
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          className={styles.content}
          data-testid="quick-add-modal"
          onEscapeKeyDown={(event) => {
            if (preventDismiss) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => {
            if (preventDismiss) {
              event.preventDefault();
            }
          }}
          onInteractOutside={(event) => {
            if (preventDismiss) {
              event.preventDefault();
            }
          }}
        >
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>{title}</Dialog.Title>
            <Dialog.Description className={styles.srOnly}>
              Modal for quickly adding a new tour target.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button
                type="button"
                className={styles.closeButton}
                aria-label="Close"
                disabled={preventDismiss}
              >
                ×
              </button>
            </Dialog.Close>
          </header>
          <div className={styles.body}>
            {description ? (
              typeof description === "string" ? (
                <p className={styles.description}>{description}</p>
              ) : (
                description
              )
            ) : null}
            {apiError ? (
              <Alert
                variant="error"
                className={styles.errorBanner}
                role="alert"
                data-testid="quick-add-modal-error"
              >
                {apiError}
              </Alert>
            ) : null}
            <div className={styles.formWrap}>
              <FormComponent {...formProps} />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type QuickAddModalState = {
  config: QuickAddModalConfig<unknown>;
};

type QuickAddModalContextValue = {
  /** Opens the modal with title, form component, and parent `onSuccess` bridge. */
  open: <TEntity>(props: QuickAddModalOpenProps<TEntity>) => void;
  close: () => void;
  isOpen: boolean;
};

const QuickAddModalContext = createContext<QuickAddModalContextValue | null>(null);

export type QuickAddModalProviderProps = {
  children: ReactNode;
  /**
   * When set, `persistWizardState: true` snapshots the wizard draft to sessionStorage
   * + localStorage before the modal opens (see `persistWizardSnapshotForQuickAdd`).
   */
  wizardPersistence?: WizardPersistenceConfig;
};

export function QuickAddModalProvider({
  children,
  wizardPersistence,
}: QuickAddModalProviderProps) {
  const [state, setState] = useState<QuickAddModalState | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const close = useCallback(() => {
    if (isSubmitting) {
      return;
    }
    setState((prev) => {
      prev?.config.onClose?.();
      return null;
    });
    setApiError(null);
    setIsSubmitting(false);
    restoreWizardDraftFromQuickAddGuard();
    clearWizardQuickAddGuard();
  }, [isSubmitting]);

  const open = useCallback(
    <TEntity,>(props: QuickAddModalOpenProps<TEntity>) => {
      if (props.persistWizardState && wizardPersistence) {
        const serialized = wizardPersistence.serializeDraft(wizardPersistence.getFormValues());
        persistWizardSnapshotForQuickAdd({
          storageKey: wizardPersistence.storageKey,
          serializedDraft: serialized,
        });
      }
      setApiError(null);
      setIsSubmitting(false);
      setState({ config: props as QuickAddModalConfig<unknown> });
    },
    [wizardPersistence],
  );

  const handleFormSuccess = useCallback((entity: unknown) => {
    setState((prev) => {
      prev?.config.onSuccess(entity);
      return null;
    });
    setApiError(null);
    setIsSubmitting(false);
    clearWizardQuickAddGuard();
  }, []);

  const contextValue = useMemo(
    (): QuickAddModalContextValue => ({
      open,
      close,
      isOpen: state != null,
    }),
    [close, open, state],
  );

  const formProps: QuickAddFormProps<unknown> | null = state
    ? {
        onSuccess: handleFormSuccess,
        onCancel: close,
        isPending: isSubmitting,
        setError: setApiError,
        setPending: setIsSubmitting,
      }
    : null;

  return (
    <QuickAddModalContext.Provider value={contextValue}>
      {children}
      {state && formProps ? (
        <QuickAddModal
          open
          onClose={close}
          title={state.config.title}
          description={state.config.description}
          apiError={apiError}
          formComponent={state.config.formComponent}
          formProps={formProps}
        />
      ) : null}
    </QuickAddModalContext.Provider>
  );
}

export function useQuickAddModal(): QuickAddModalContextValue {
  const ctx = useContext(QuickAddModalContext);
  if (!ctx) {
    throw new Error("useQuickAddModal must be used within QuickAddModalProvider");
  }
  return ctx;
}

export { DestinationQuickAddForm, EquipmentQuickAddForm };
export {
  clearWizardQuickAddGuard,
  persistWizardSnapshotForQuickAdd,
  QUICK_ADD_WIZARD_GUARD_SESSION_KEY,
  restoreWizardDraftFromQuickAddGuard,
} from "./quick-add/persistWizardSnapshot";
export type {
  QuickAddEntityType,
  QuickAddFormProps,
  QuickAddModalConfig,
  QuickAddModalOpenProps,
  WizardPersistenceConfig,
} from "./quick-add/types";
