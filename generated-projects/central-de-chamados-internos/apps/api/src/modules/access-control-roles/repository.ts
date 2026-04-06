import { randomUUID } from 'crypto';
import type {
  AccessControlRoleActivityItem,
  AccessControlRoleRequest,
  AccessControlRoleResponse,
} from '../../../../../packages/shared/src/contracts/access-control-roles.ts';

const records: AccessControlRoleResponse[] = [];

export class AccessControlRolesRepository {
  list(): AccessControlRoleResponse[] {
    return [...records].sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt)));
  }

  activity(limit = 10): AccessControlRoleActivityItem[] {
    return this.list()
      .slice(0, limit)
      .map((record) => ({
        id: record.id,
        status: record.status,
        summary: `${record.roleName} com escopo ${record.accessScope}`,
        createdAt: record.updatedAt || record.createdAt,
      }));
  }

  findByRoleName(roleName: string): AccessControlRoleResponse | undefined {
    return records.find((record) => record.roleName === roleName);
  }

  create(input: AccessControlRoleRequest): AccessControlRoleResponse {
    const item: AccessControlRoleResponse = {
      id: randomUUID(),
      roleName: input.roleName,
      permissionMatrix: input.permissionMatrix,
      accessScope: input.accessScope,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    records.unshift(item);
    return item;
  }

  update(id: string, input: AccessControlRoleRequest): AccessControlRoleResponse {
    const record = records.find((item) => item.id === id);
    if (!record) {
      throw new Error('Perfil de acesso nao encontrado.');
    }

    record.roleName = input.roleName;
    record.permissionMatrix = input.permissionMatrix;
    record.accessScope = input.accessScope;
    record.updatedAt = new Date().toISOString();

    return record;
  }

  seed(items: AccessControlRoleRequest[]): void {
    for (const item of items) {
      if (!this.findByRoleName(item.roleName)) {
        this.create(item);
      }
    }
  }
}

export const accessControlRolesRepository = new AccessControlRolesRepository();
