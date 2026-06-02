"use client";

import type { DenaliWizardHeaderPlugin, DenaliWizardHeaderPluginContext } from "../application/denaliWizardHeaderPlugin";

export type DenaliWizardHeaderPluginsProps = {
  plugins: readonly DenaliWizardHeaderPlugin[];
  context: DenaliWizardHeaderPluginContext;
};

export function DenaliWizardHeaderPlugins({ plugins, context }: DenaliWizardHeaderPluginsProps) {
  return (
    <>
      {plugins.map((plugin) => {
        if (!plugin.shouldRender(context)) {
          return null;
        }
        return (
          <div key={plugin.id} data-denali-wizard-plugin={plugin.id}>
            {plugin.render(context)}
          </div>
        );
      })}
    </>
  );
}
