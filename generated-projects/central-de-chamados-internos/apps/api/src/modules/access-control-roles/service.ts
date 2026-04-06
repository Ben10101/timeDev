import pino from 'pino';
import type {
  AccessControlRoleListResponse,
  AccessControlRoleRequest,
  AccessControlRoleResponse,
} from '../../../../../packages/shared/src/contracts/access-control-roles.ts';
import { accessControlRoleSchema } from './schema';
import { accessControlRolesRepository } from './repository';

const logger = pino({ name: 'access-control-roles-service' });

export class AccessControlRolesService {
  list(): AccessControlRoleListResponse {
    return { items: accessControlRolesRepository.list() };
  }

  create(input: AccessControlRoleRequest): AccessControlRoleResponse {
    const parsedInput = accessControlRoleSchema.parse(input);
    const duplicatedRole = accessControlRolesRepository.findByRoleName(parsedInput.roleName);

    if (duplicatedRole) {
      throw new Error('Ja existe um perfil configurado para esta funcao.');
    }

    const created = accessControlRolesRepository.create(parsedInput);
    logger.info({ roleName: created.roleName, accessScope: created.accessScope }, 'Perfil de acesso criado');
    return created;
  }

  buildSeedRecordsFromTask(): AccessControlRoleRequest[] {
    return [
      {
        roleName: 'solicitante',
        permissionMatrix: 'Abrir chamados; acompanhar status; anexar comprovantes',
        accessScope: 'self_service',
      },
      {
        roleName: 'analista',
        permissionMatrix: 'Atender chamados; comentar; reclassificar prioridade',
        accessScope: 'team',
      },
      {
        roleName: 'gestor',
        permissionMatrix: 'Acompanhar indicadores; revisar carga da equipe; reatribuir chamados',
        accessScope: 'global',
      },
    ];
  }
}

export const AccessControlRoleServiceInstance = new AccessControlRolesService();
accessControlRolesRepository.seed(AccessControlRoleServiceInstance.buildSeedRecordsFromTask());
