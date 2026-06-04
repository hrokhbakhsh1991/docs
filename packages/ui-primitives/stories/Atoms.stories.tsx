import type { Meta, StoryObj } from "@storybook/react";

import { Alert } from "../src/Alert/Alert";
import { Badge } from "../src/Badge/Badge";
import { Button } from "../src/Button/Button";
import { FieldShell } from "../src/FieldShell/FieldShell";
import { Checkbox } from "../src/Checkbox/Checkbox";
import { Input } from "../src/Input/Input";
import { Select } from "../src/Select/Select";

const meta: Meta = {
  title: "Atoms/Form",
};

export default meta;

export const ButtonPrimary: StoryObj = {
  render: () => <Button variant="primary">Primary</Button>,
};

export const ButtonSecondary: StoryObj = {
  render: () => <Button variant="secondary">Secondary</Button>,
};

export const InputField: StoryObj = {
  render: () => <Input aria-label="Title" placeholder="Enter title" />,
};

export const SelectField: StoryObj = {
  render: () => (
    <Select
      aria-label="Status"
      options={[
        { value: "draft", label: "Draft" },
        { value: "open", label: "Open" },
      ]}
      value="draft"
    />
  ),
};

export const CheckboxField: StoryObj = {
  render: () => <Checkbox aria-label="Featured tour" defaultChecked />,
};

export const FieldShellExample: StoryObj = {
  render: () => (
    <FieldShell label="Email" helperText="Work email" required>
      <Input type="email" />
    </FieldShell>
  ),
};

export const AlertInfo: StoryObj = {
  render: () => (
    <Alert variant="info" title="Policy update">
      Review the new cancellation rules before publishing.
    </Alert>
  ),
};

export const BadgeVariants: StoryObj = {
  render: () => (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <Badge variant="neutral">Draft</Badge>
      <Badge variant="success">Open</Badge>
      <Badge variant="warning">Pending</Badge>
      <Badge variant="danger">Closed</Badge>
      <Badge variant="info">New</Badge>
    </div>
  ),
};
