"use client";

import type { ReactNode } from "react";

type Props = {
  overview?: {
    title?: string;
    shortDescription?: string;
    longDescription?: string;
    communicationLink?: string;
  };
  comm?: string;
  communicationHref?: string;
  SummaryRow: (props: { label: string; value: ReactNode }) => JSX.Element;
};

export function SummarySection({ overview, comm, communicationHref, SummaryRow }: Props) {
  return (
    <section>
      <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>اطلاعات پایه</h3>
      <dl style={{ margin: 0, display: "grid", gap: "0.5rem" }}>
        <SummaryRow label="عنوان" value={overview?.title} />
        <SummaryRow label="توضیح کوتاه" value={overview?.shortDescription} />
        <SummaryRow label="توضیح کامل" value={overview?.longDescription} />
        <SummaryRow
          label="لینک گروه هماهنگی"
          value={
            comm ? (
              <a href={communicationHref} rel="noopener noreferrer" target="_blank" style={{ color: "#2563eb" }}>
                {comm.length > 64 ? `${comm.slice(0, 64)}…` : comm}
              </a>
            ) : undefined
          }
        />
      </dl>
    </section>
  );
}
