"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import { Button, FormField, Input, Modal, Select } from "@tour/ui";

import { ApiError } from "@/lib/api-client";
import { UserRole } from "@/lib/auth/user-role";
import {
  inviteUser,
  type InvitableWorkspaceRole,
  type InviteUserResult
} from "@/lib/services/users.service";
import { useAppToast } from "@/lib/use-app-toast";
import { useWorkspaceQueryScope } from "@/hooks/use-workspace-query-scope";

import {
  migrateInviteNameNotePhoneToInviteId,
  setInviteNameNoteForPhone
} from "../invite-name-notes";
import { USERS_ROUTE_COPY } from "../users-copy";

const copy = USERS_ROUTE_COPY.list.inviteModal;

const INVITE_ROLES: { value: InvitableWorkspaceRole; label: string }[] = [
  { value: UserRole.Admin, label: copy.roleAdmin },
  { value: UserRole.Member, label: copy.roleMember },
  { value: UserRole.Viewer, label: copy.roleViewer }
];

export type WorkspaceInviteModalProps = {
  open: boolean;
  onClose: () => void;
  onInvited?: (_result: InviteUserResult) => void | Promise<void>;
};

export function WorkspaceInviteModal({
  open,
  onClose,
  onInvited
}: WorkspaceInviteModalProps): JSX.Element | null {
  const toast = useAppToast();
  const tenantId = useWorkspaceQueryScope() ?? "";
  const [phone, setPhone] = useState("");
  const [nameNote, setNameNote] = useState("");
  const [role, setRole] = useState<InvitableWorkspaceRole>(UserRole.Member);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inviteMutation = useMutation({
    mutationFn: (payload: { phone: string; role: InvitableWorkspaceRole }) =>
      inviteUser(payload),
    onSuccess: async (result) => {
      const trimmedPhone = phone.trim();
      const note = nameNote.trim();
      if (note && tenantId) {
        setInviteNameNoteForPhone(tenantId, trimmedPhone, note);
        migrateInviteNameNotePhoneToInviteId(tenantId, trimmedPhone, result.inviteId);
      }
      toast.success({ message: copy.successToast });
      await onInvited?.(result);
      setPhone("");
      setNameNote("");
      setRole(UserRole.Member);
      setErrorMessage(null);
      inviteMutation.reset();
      onClose();
    },
    onError: (err: unknown) => {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : copy.submitErrorFallback;
      setErrorMessage(message);
      toast.error({ message });
    }
  });

  const isPending = inviteMutation.isPending;

  const resetForm = useCallback(() => {
    setPhone("");
    setNameNote("");
    setRole(UserRole.Member);
    setErrorMessage(null);
    inviteMutation.reset();
  }, [inviteMutation]);

  const handleClose = useCallback(() => {
    if (isPending) return;
    resetForm();
    onClose();
  }, [isPending, onClose, resetForm]);

  const canSubmit = useMemo(
    () => phone.trim().length > 0 && !isPending,
    [phone, isPending]
  );

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    setErrorMessage(null);
    inviteMutation.mutate({
      phone: phone.trim(),
      role
    });
  }, [canSubmit, inviteMutation, phone, role]);

  if (!open) {
    return null;
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={copy.title}
      footer={
        <>
          <Button type="button" variant="ghost" disabled={isPending} onClick={handleClose}>
            {copy.cancelButton}
          </Button>
          <Button type="button" variant="primary" disabled={!canSubmit} onClick={handleSubmit}>
            {isPending ? copy.submittingButton : copy.submitButton}
          </Button>
        </>
      }
    >
      <div dir="rtl" style={{ display: "grid", gap: 12 }} aria-busy={isPending}>
        <FormField label={copy.phoneLabel}>
          <Input
            type="tel"
            value={phone}
            autoComplete="off"
            placeholder={copy.phonePlaceholder}
            disabled={isPending}
            onChange={(e) => setPhone(e.target.value)}
          />
        </FormField>
        <FormField label={copy.nameNoteLabel} description={copy.nameNoteHint}>
          <Input
            value={nameNote}
            disabled={isPending}
            placeholder={copy.nameNotePlaceholder}
            onChange={(e) => setNameNote(e.target.value)}
          />
        </FormField>
        <FormField label={copy.roleLabel}>
          <Select
            value={role}
            disabled={isPending}
            onChange={(e) => setRole(e.target.value as InvitableWorkspaceRole)}
          >
            {INVITE_ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </FormField>
        {errorMessage ? (
          <small role="alert" style={{ color: "var(--color-danger, #b42318)" }}>
            {errorMessage}
          </small>
        ) : null}
      </div>
    </Modal>
  );
}
