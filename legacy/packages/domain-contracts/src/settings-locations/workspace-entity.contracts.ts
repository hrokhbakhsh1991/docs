export const WORKSPACE_REGION_ENTITY = "WorkspaceRegionEntity";
export const WORKSPACE_DESTINATION_ENTITY = "WorkspaceDestinationEntity";

export interface IWorkspaceRegionEntity {
  id: string;
  destinations?: IWorkspaceDestinationEntity[];
}

export interface IWorkspaceDestinationEntity {
  id: string;
  region: IWorkspaceRegionEntity;
}
