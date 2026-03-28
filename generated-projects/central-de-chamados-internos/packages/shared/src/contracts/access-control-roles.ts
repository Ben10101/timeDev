export interface AccessControlRoleRequest {
  roleName: string;
  permissionMatrix: string;
  accessScope: string;
}
export interface AccessControlRoleResponse {
  id: string;
  roleName: string;
  permissionMatrix: string;
  accessScope: string;
  status: 'draft' | 'active';
  createdAt: string;
}
export interface AccessControlRoleListResponse {
  items: AccessControlRoleResponse[];
}