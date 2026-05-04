"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@tour/ui";
import { clearSessionToken } from "@/lib/auth/session";

export function LogoutButton(): JSX.Element {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout(): Promise<void> {
    if (isLoading) {
      return;
    }
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      });
    } finally {
      clearSessionToken();
      router.refresh();
      router.push("/login");
      setIsLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="danger"
      size="sm"
      loading={isLoading}
      disabled={isLoading}
      onClick={handleLogout}
      aria-label="Logout"
    >
      Logout
    </Button>
  );
}
