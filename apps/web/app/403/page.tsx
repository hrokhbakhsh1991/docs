"use client";

import { useRouter } from "next/navigation";

import { Button } from "@tour/ui";

export default function ForbiddenPage() {
  const router = useRouter();

  return (
    <main
      dir="rtl"
      style={{
        minHeight: "100vh",
        padding: "var(--space-6) var(--space-page-gutter)",
        background: "var(--color-bg-page)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-family-base)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "var(--space-4)",
      }}
    >
      <h1 style={{ marginTop: 0, marginBottom: 0, fontSize: "1.25rem" }}>دسترسی غیرمجاز</h1>
      <p style={{ margin: 0, color: "var(--color-text-secondary)", maxWidth: "28rem", lineHeight: 1.6 }}>
        شما به این بخش دسترسی ندارید (403).
      </p>
      <Button type="button" variant="primary" onClick={() => router.push("/tours")}>
        بازگشت به صفحه اصلی
      </Button>
    </main>
  );
}
