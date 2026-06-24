import type { ComponentType, ReactNode } from "react";

import type { EquipmentIconKey } from "../../settings/equipment-icon-registry";

function IconBase({
  className,
  children,
}: {
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

function BackpackIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M8 10h8" />
      <path d="M8 18h8" />
      <path d="M8 22v-6" />
      <path d="M16 22v-6" />
      <path d="M12 6V4a2 2 0 0 0-2-2H10" />
    </IconBase>
  );
}

function TrekkingPolesIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M8 3v18" />
      <path d="M16 3v18" />
      <path d="M6 7h4" />
      <path d="M14 7h4" />
      <path d="M5 21h6" />
      <path d="M13 21h6" />
    </IconBase>
  );
}

function BootIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M4 15h12l2 4H4z" />
      <path d="M6 15V9a2 2 0 0 1 2-2h4" />
      <path d="M10 7V5" />
    </IconBase>
  );
}

function MountainIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="m8 21 4-9 4 9" />
      <path d="M2 21h20" />
      <path d="m14 12 3-5 3 5" />
    </IconBase>
  );
}

function MapIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M9 18 3 20V6l6-2 6 2 6-2v14l-6 2-6-2Z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </IconBase>
  );
}

function CompassIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="m16 8-4 8-4-8 8-4Z" />
    </IconBase>
  );
}

function TentIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M3 21 12 3l9 18Z" />
      <path d="M12 3v18" />
    </IconBase>
  );
}

function SleepingBagIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M4 10c0-2 2-4 8-4s8 2 8 4v8H4Z" />
      <path d="M8 14h8" />
    </IconBase>
  );
}

function FlashlightIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M10 2h4v4l-2 16-2-16Z" />
      <path d="M9 6h6" />
    </IconBase>
  );
}

function GlovesIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M8 11V8a2 2 0 1 1 4 0v8" />
      <path d="M12 11V7a2 2 0 1 1 4 0v9a5 5 0 0 1-5 5H9a3 3 0 0 1-3-3v-4" />
    </IconBase>
  );
}

function JacketIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M12 3 8 7v14h8V7Z" />
      <path d="M8 7H5a2 2 0 0 0-2 2v3" />
      <path d="M16 7h3a2 2 0 0 1 2 2v3" />
    </IconBase>
  );
}

function GlassesIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <circle cx="8" cy="14" r="3" />
      <circle cx="16" cy="14" r="3" />
      <path d="M11 14h2" />
      <path d="M5 14H2" />
      <path d="M22 14h-3" />
    </IconBase>
  );
}

function HelmetIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M4 14a8 8 0 0 1 16 0" />
      <path d="M12 6V4" />
      <path d="M4 14v2h16v-2" />
    </IconBase>
  );
}

function FirstAidIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M12 10v6" />
      <path d="M9 13h6" />
    </IconBase>
  );
}

function LifeBuoyIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <path d="M4.93 4.93 9.17 9.17" />
      <path d="M14.83 14.83 19.07 19.07" />
      <path d="M14.83 9.17 19.07 4.93" />
      <path d="M4.93 19.07 9.17 14.83" />
    </IconBase>
  );
}

function WaterBottleIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M10 2h4l1 4v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V6Z" />
      <path d="M9 6h6" />
    </IconBase>
  );
}

function UtensilsIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M6 3v8" />
      <path d="M4 3v5a2 2 0 0 0 4 0V3" />
      <path d="M14 3v18" />
      <path d="M18 3v6a3 3 0 0 1-6 0V3" />
    </IconBase>
  );
}

function RopeIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M6 6c4-2 8 2 6 6s-6 6-6 6" />
      <path d="M18 18c-4 2-8-2-6-6s6-6 6-6" />
    </IconBase>
  );
}

function ToolIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="m14 6-8.5 8.5a2.12 2.12 0 1 0 3 3L17 9" />
      <path d="m16 4 4 4" />
    </IconBase>
  );
}

function CameraIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M4 8h3l2-2h6l2 2h3v12H4Z" />
      <circle cx="12" cy="13" r="3" />
    </IconBase>
  );
}

function UmbrellaIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <path d="M12 13a7 7 0 0 0 7-7H5a7 7 0 0 0 7 7Z" />
      <path d="M12 13v8" />
    </IconBase>
  );
}

function SunIcon({ className }: { readonly className?: string }) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.93 19.07 1.41-1.41" />
      <path d="m17.66 6.34 1.41-1.41" />
    </IconBase>
  );
}

const EQUIPMENT_ICON_COMPONENTS: Record<
  EquipmentIconKey,
  ComponentType<{ readonly className?: string }>
> = {
  backpack: BackpackIcon,
  trekking_poles: TrekkingPolesIcon,
  boot: BootIcon,
  mountain: MountainIcon,
  map: MapIcon,
  compass: CompassIcon,
  tent: TentIcon,
  sleeping_bag: SleepingBagIcon,
  flashlight: FlashlightIcon,
  gloves: GlovesIcon,
  jacket: JacketIcon,
  glasses: GlassesIcon,
  helmet: HelmetIcon,
  first_aid: FirstAidIcon,
  life_buoy: LifeBuoyIcon,
  water_bottle: WaterBottleIcon,
  utensils: UtensilsIcon,
  rope: RopeIcon,
  tool: ToolIcon,
  camera: CameraIcon,
  umbrella: UmbrellaIcon,
  sun: SunIcon,
};

export function EquipmentIcon({
  iconKey,
  className,
}: {
  readonly iconKey: EquipmentIconKey;
  readonly className?: string;
}) {
  const Component = EQUIPMENT_ICON_COMPONENTS[iconKey];
  return <Component className={className} />;
}
