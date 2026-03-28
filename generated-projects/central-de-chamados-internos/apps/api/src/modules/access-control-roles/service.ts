import { randomUUID } from 'crypto';
import type { AccessControlRoleListResponse, AccessControlRoleRequest, AccessControlRoleResponse } from '../../../../../packages/shared/src/contracts/access-control-roles.ts';
const records: AccessControlRoleResponse[] = [];
/**
 * - O aluno precisa estar autenticado e com conta ativa para atualizar o perfil.
 * - O sistema nao deve permitir registros com e-mail duplicado.
 */
export class AccessControlRolesService {
  list(): AccessControlRoleListResponse {
    return { items: records };
  }
  create(input: AccessControlRoleRequest): AccessControlRoleResponse {
    const item: AccessControlRoleResponse = {
      id: randomUUID(),
      roleName: input.roleName,
      permissionMatrix: input.permissionMatrix,
      accessScope: input.accessScope,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    records.push(item);
    return item;
  }
  buildSeedFromTask(): AccessControlRoleRequest {
    return {
      roleName: 'gestor',
      permissionMatrix: 'acompanhar chamados; aprovar atendimento; administrar usuarios',
      accessScope: 'global',
    };
  }
}
export const AccessControlRoleServiceInstance = new AccessControlRolesService();
records.push(AccessControlRoleServiceInstance.create(AccessControlRoleServiceInstance.buildSeedFromTask()));