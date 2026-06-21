import { buildPlatformAdminUrl } from "./build-platform-admin-url";

export function MaintenancePage({ title }: { readonly title: string }) {
  return (
    <main data-platform-maintenance className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">این بخش در دست تعمیر است.</p>
      <div className="flex flex-wrap gap-4 text-sm">
        <a href="/" className="underline">
          صفحه اصلی
        </a>
        <a href={buildPlatformAdminUrl()} data-platform-admin-cta className="underline">
          ورود PlatformOps
        </a>
      </div>
    </main>
  );
}
