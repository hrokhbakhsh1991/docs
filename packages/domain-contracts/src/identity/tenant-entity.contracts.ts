export const TENANT_ENTITY = "TenantEntity";
export const USER_TENANT_ENTITY = "UserTenantEntity";
export const USER_ENTITY = "UserEntity";

export interface ITenantEntity {
  id: string;
  members?: IUserTenantEntity[];
}

export interface IUserTenantEntity {
  id: string;
  tenantId: string;
  userId: string;
  tenant: ITenantEntity;
  user: IUserEntity;
}

export interface IUserEntity {
  id: string;
  memberships?: IUserTenantEntity[];
}
