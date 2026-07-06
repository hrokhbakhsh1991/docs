import { buildPlatformAdminUrl } from "./build-platform-admin-url";

export function MaintenancePage({ title }: { readonly title: string }) {
  return (
    <main data-platform-maintenance data-slot="shell-main">
      <h1>{title}</h1>
      <p data-platform-maintenance-lead>این بخش در دست تعمیر است.</p>
      <div data-platform-maintenance-links>
        <a href="/">صفحه اصلی</a>
        <a href={buildPlatformAdminUrl()} data-platform-admin-cta>
          ورود PlatformOps
        </a>
      </div>
    </main>
  );
}
