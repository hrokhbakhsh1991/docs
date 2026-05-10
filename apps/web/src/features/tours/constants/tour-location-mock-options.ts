/** Mock region/destination options until Settings → Locations is wired to the tour API. */
export type TourLocationRegionOption = { id: string; name: string; isActive: boolean };
export type TourLocationDestinationOption = { id: string; name: string; regionId: string; isActive: boolean };

export const MOCK_TOUR_LOCATION_REGIONS: TourLocationRegionOption[] = [
  { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "البرز مرکزی", isActive: true },
  { id: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12", name: "فارس جنوبی", isActive: true },
  { id: "c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13", name: "خراسان", isActive: false },
];

export const MOCK_TOUR_LOCATION_DESTINATIONS: TourLocationDestinationOption[] = [
  {
    id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21",
    name: "دیزین",
    regionId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    isActive: true,
  },
  {
    id: "d1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    name: "شمشک",
    regionId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    isActive: true,
  },
  {
    id: "d2eebc99-9c0b-4ef8-bb6d-6bb9bd380a23",
    name: "شیراز",
    regionId: "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
    isActive: true,
  },
];
