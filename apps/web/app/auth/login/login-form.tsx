"use client";

import { useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, FormField, Input, useToast } from "@tour/ui";

import {
  WorkspacePickerModal,
  type WorkspacePickerItem
} from "@/components/workspace";
import { isLeaderRole, useAuth } from "@/lib/auth/auth-context";
import { decodeJwtPayload } from "@/lib/auth/decode-jwt-payload";
import type { WebSessionResponseBody } from "@/lib/auth/types";
import { ApiError } from "@/lib/api-client";
import {
  createWorkspaceSession,
  loginWebSession
} from "@/lib/services/auth.service";
import { getAuthWorkspaces } from "@/lib/services/auth-workspaces.service";

import authStyles from "../auth-forms.module.css";

const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function resolveSubmitErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes("not configured")) {
    return "Application configuration is incomplete. Check NEXT_PUBLIC_API_URL and NEXT_PUBLIC_TENANT_ID.";
  }
  if (error instanceof ApiError) {
    return error.message.trim() || "Invalid email or password.";
  }
  if (error instanceof Error) {
    return error.message.trim() || "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

export function LoginForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const { setSession, clearSession } = useAuth();

  const [workspacePickerOpen, setWorkspacePickerOpen] = useState(false);
  const [prefetchedWorkspaces, setPrefetchedWorkspaces] = useState<
    WorkspacePickerItem[] | undefined
  >(undefined);
  const initialSessionRef = useRef<WebSessionResponseBody | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
    mode: "onChange",
  });

  function resetWorkspacePickerState(): void {
    setWorkspacePickerOpen(false);
    setPrefetchedWorkspaces(undefined);
    initialSessionRef.current = null;
  }

  function finishPostAuthNavigation(sessionToken: string): void {
    showToast({ type: "success", message: "Login successful" });
    const claims = decodeJwtPayload(sessionToken);
    const role = typeof claims?.role === "string" ? claims.role.trim() : undefined;
    void router.refresh();
    router.push(isLeaderRole(role) ? "/dashboard" : "/tours");
  }

  function handleWorkspacePickerClose(): void {
    const token = initialSessionRef.current?.session_token;
    resetWorkspacePickerState();
    if (token) {
      finishPostAuthNavigation(token);
    }
  }

  async function handleWorkspaceSelected(workspace: WorkspacePickerItem): Promise<void> {
    const initial = initialSessionRef.current;
    if (!initial) {
      return;
    }

    if (workspace.tenant_id === initial.tenant_id) {
      const token = initial.session_token;
      resetWorkspacePickerState();
      finishPostAuthNavigation(token);
      return;
    }

    try {
      const session = await createWorkspaceSession(workspace.tenant_id);
      setSession(session);
      resetWorkspacePickerState();
      finishPostAuthNavigation(session.session_token);
    } catch (err: unknown) {
      showToast({ type: "error", message: resolveSubmitErrorMessage(err) });
    }
  }

  async function onValid(data: LoginFormValues): Promise<void> {
    try {
      const session = await loginWebSession(data.email, data.password);
      setSession(session);

      let workspaces: WorkspacePickerItem[];
      try {
        workspaces = await getAuthWorkspaces();
      } catch (err: unknown) {
        clearSession();
        showToast({ type: "error", message: resolveSubmitErrorMessage(err) });
        return;
      }

      if (workspaces.length === 1) {
        finishPostAuthNavigation(session.session_token);
        return;
      }

      initialSessionRef.current = session;
      setPrefetchedWorkspaces(workspaces);
      setWorkspacePickerOpen(true);
    } catch (err: unknown) {
      showToast({ type: "error", message: resolveSubmitErrorMessage(err) });
    }
  }

  return (
    <>
      <h1 className={authStyles.heading}>Login</h1>
      <p className={authStyles.lead}>Sign in with your workspace email and password.</p>
      <form className={authStyles.form} onSubmit={handleSubmit(onValid)} noValidate>
        <FormField label="Email" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={errors.email ? true : undefined}
            disabled={isSubmitting}
            {...register("email")}
          />
        </FormField>
        <FormField label="Password" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? true : undefined}
            disabled={isSubmitting}
            {...register("password")}
          />
        </FormField>
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting || !isValid}>
          Sign in
        </Button>
      </form>
      <p className={authStyles.footerNote}>
        No account?{" "}
        <Link href="/auth/register" className={authStyles.footerLink}>
          Register
        </Link>
      </p>

      <WorkspacePickerModal
        open={workspacePickerOpen}
        onClose={handleWorkspacePickerClose}
        onSelect={(ws) => void handleWorkspaceSelected(ws)}
        prefetchedWorkspaces={prefetchedWorkspaces}
        title="Choose workspace"
      />
    </>
  );
}
