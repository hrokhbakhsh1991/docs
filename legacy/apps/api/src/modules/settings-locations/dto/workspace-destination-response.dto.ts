export type WorkspaceDestinationResponseDto = {
  id: string;
  name: string;
  regionId: string;
  type: string | null;
  altitudeM: number | null;
  sortOrder: number | null;
  isActive: boolean;
};
