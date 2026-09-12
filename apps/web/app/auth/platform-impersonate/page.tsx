"use client";

import { useRouter } from "next/navigation";
import { useAppSearchParams } from "@/navigation/app-navigation-hooks";
import { useEffect, useState } from "react";

export default function PlatformImpersonatePage() {
  const router = useRouter();
  const searchParams = useAppSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token")?.trim() ?? "";
    if (token.length === 0) {
      setError("Missing impersonation token");
      return;
    }

    void (async () => {
      const response = await fetch("/api/auth/platform-impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: token }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Failed to accept impersonation session");
        return;
      }
      router.replace("/dashboard");
    })();
  }, [router, searchParams]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center p-6">
        <p className="text-sm text-destructive">{error}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col justify-center p-6">
      <p className="text-sm text-muted-foreground">Opening read-only operator session…</p>
    </main>
  );
}
