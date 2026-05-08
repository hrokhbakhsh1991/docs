"use client";

import { useCallback, useMemo, useState } from "react";

import { Button, FormField, Input, Modal, Select } from "@tour/ui";

import { ApiError } from "@/lib/api-client";
import { inviteUser } from "@/lib/services/users.service";
import { useAppToast } from "@/lib/use-app-toast";

type InviteRole = "admin" | "member" | "viewer";

export type InviteUserModalProps = {
  open: boolean;
  onClose: () => void;
  /** Called after successful invite to refresh users list. */
  onInvited?: () => void | Promise<void>;
};

const DEFAULT_ROLE: InviteRole = "member";

export function InviteUserModal({ open, onClose, onInvited }: InviteUserModalProps): JSX.Element {
  const toast = useAppToast();
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<InviteRole>(DEFAULT_ROLE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => phone.trim().length > 0 && !isSubmitting,
    [phone, isSubmitting]
  );

  const resetForm = useCallback(() => {
    setPhone("");
    setRole(DEFAULT_ROLE);
    setErrorMessage(null);
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  }, [isSubmitting, onClose, resetForm]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const normalizedPhone = phone.trim();
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await inviteUser({
        phone: normalizedPhone,
        role
      });
      toast.success({ message: "Invitation sent." });
      if (onInvited) {
        await onInvited();
      }
      resetForm();
      onClose();
    } catch (error: unknown) {
      setErrorMessage(error instanceof ApiError ? error.message : "Failed to invite user.");
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, onClose, onInvited, phone, resetForm, role, toast]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Invite User"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {isSubmitting ? "Sending..." : "Send Invite"}
          </Button>
        </>
      }
    >
      <div style={{ display: "grid", gap: 12 }}>
        <FormField label="Phone number">
          <Input
            type="tel"
            value={phone}
            autoComplete="off"
            placeholder="+15551234567"
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSubmitting}
          />
        </FormField>
        <FormField label="Role">
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as InviteRole)}
            disabled={isSubmitting}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </Select>
        </FormField>
        {errorMessage ? <small role="alert">{errorMessage}</small> : null}
      </div>
    </Modal>
  );
}

