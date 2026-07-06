import Link from "next/link";

export function MemberPortalDisabled() {
  return (
    <main data-member-portal-disabled>
      <p role="status">Member area is not available for this workspace.</p>
      <p>
        <Link href="/">Return to home</Link>
      </p>
    </main>
  );
}
