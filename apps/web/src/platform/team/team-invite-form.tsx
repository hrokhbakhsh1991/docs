"use client";

import { Input } from "@app-tour/ui-primitives/input";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TeamInviteFormProps = {
  readonly canInvite: boolean;
};

export function TeamInviteForm({ canInvite }: TeamInviteFormProps) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"admin" | "support">("support");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  if (!canInvite) {
    return null;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/platform/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, role }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
        setError(body.error?.message ?? "Invite failed");
        return;
      }
      setPhone("");
      router.refresh();
    } catch {
      setError("Invite failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-lg border border-border p-4"
      data-testid="platform-team-invite-form"
      data-client-ready={clientReady ? "true" : undefined}
    >
      <h2 className="text-lg font-medium">Invite member</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Phone</span>
          <Input
            className="w-full rounded-md border border-border px-3 py-2"
            name="phone"
            data-testid="platform-team-invite-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Role</span>
          <select
            className="w-full rounded-md border border-border px-3 py-2"
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as "admin" | "support")}
          >
            <option value="admin">admin</option>
            <option value="support">support</option>
          </select>
        </label>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        data-testid="platform-team-invite-submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save member"}
      </button>
    </form>
  );
}
