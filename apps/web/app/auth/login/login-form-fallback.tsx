import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Shown while client-only LoginForm bundle loads (avoids hydration stall on phone input). */
export function LoginFormFallback() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden bg-muted/40 px-4 py-4 sm:py-6">
      <Card className="w-full max-w-md overflow-hidden shadow-lg">
        <CardHeader className="space-y-2 pb-4 text-center sm:text-start">
          <CardTitle className="text-xl">ورود</CardTitle>
          <CardDescription>در حال بارگذاری…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-primary/30" />
        </CardContent>
      </Card>
    </div>
  );
}
