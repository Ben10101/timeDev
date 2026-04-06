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
  updatedAt?: string;
}
export interface AccessControlRoleListResponse {
  items: AccessControlRoleResponse[];
  meta?: {
    mode: 'settings';
    total: number;
  };
}

export interface AccessControlRoleActivityItem {
  id: string;
  status: 'draft' | 'active';
  summary: string;
  createdAt: string;
}

export interface AccessControlRoleActivityResponse {
  items: AccessControlRoleActivityItem[];
}
