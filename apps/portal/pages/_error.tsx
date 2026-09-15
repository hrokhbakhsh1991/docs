import type { NextPageContext } from "next";

type ErrorPageProps = {
  readonly statusCode: number;
};

/**
 * Minimal Pages Router error stub — disables Next.js built-in `/_error` static
 * `/404` + `/500` export (Html guard) while App Router owns runtime surfaces.
 */
function PortalPagesError({ statusCode }: ErrorPageProps) {
  return (
    <main data-portal-pages-error data-status-code={statusCode}>
      <h1>Error {statusCode}</h1>
    </main>
  );
}

PortalPagesError.getInitialProps = ({ res, err }: NextPageContext): ErrorPageProps => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return { statusCode };
};

export default PortalPagesError;
