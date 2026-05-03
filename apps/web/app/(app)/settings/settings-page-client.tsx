"use client";

import { Card, CardBody, CardHeader, CardSubtitle, CardTitle } from "@tour/ui";

import { RegisteredWorkspacePage } from "@/layouts/RegisteredWorkspacePage";

import { SettingsProfileForm } from "./settings-profile-form";

export function SettingsPageClient() {
  return (
    <RegisteredWorkspacePage
      documentTitle="Settings"
      title="Settings"
      description="Profile preferences and notification settings."
      breadcrumbItems={[
        { label: "Home", href: "/dashboard" },
        { label: "Settings" },
      ]}
      actions={null}
    >
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardSubtitle>Notification preferences and contact details.</CardSubtitle>
        </CardHeader>
        <CardBody>
          <SettingsProfileForm />
        </CardBody>
      </Card>
    </RegisteredWorkspacePage>
  );
}
