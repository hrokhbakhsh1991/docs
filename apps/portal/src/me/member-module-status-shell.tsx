import type { ReactNode } from "react";

type MemberModuleStatusShellProps = {
  readonly children?: ReactNode;
  readonly description: string;
  readonly eyebrow?: string;
  readonly headerProps?: Record<string, string | undefined>;
  readonly heading: string;
  readonly mainProps?: Record<string, string | undefined>;
};

export function MemberModuleStatusShell({
  children,
  description,
  eyebrow,
  headerProps,
  heading,
  mainProps,
}: MemberModuleStatusShellProps) {
  return (
    <main {...mainProps}>
      <section data-portal-member-status-card>
        <div data-portal-member-status-body>
          <div data-portal-member-status-mark aria-hidden="true">
            <div data-portal-member-status-mark-inner />
          </div>
          <header
            data-portal-member-page-header
            data-portal-member-status-header
            {...headerProps}
          >
            {eyebrow !== undefined ? <p data-portal-member-status-eyebrow>{eyebrow}</p> : null}
            <h1>{heading}</h1>
            <p data-portal-member-status-description>{description}</p>
          </header>
          {children}
        </div>
      </section>
    </main>
  );
}
