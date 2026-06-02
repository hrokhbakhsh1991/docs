"use client";

import { Card, CardBody, CardHeader, CardTitle } from "@tour/ui";

export type MetricCardProps = {
  title: string;
  value: string | number;
};

export function MetricCard({ title, value }: MetricCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardBody>
        <strong>{value}</strong>
      </CardBody>
    </Card>
  );
}

