import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Docs/Welcome",
  parameters: {
    layout: "centered",
  },
};

export default meta;

type Story = StoryObj;

export const Overview: Story = {
  render: () => (
    <p style={{ fontFamily: "system-ui, sans-serif", maxWidth: 420 }}>
      Tour Ops Storybook — co-locate <code>*.stories.tsx</code> next to components under{" "}
      <code>src/</code> or add stories here.
    </p>
  ),
};
