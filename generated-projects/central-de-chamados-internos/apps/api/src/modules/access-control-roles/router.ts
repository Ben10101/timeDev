import { Router } from 'express';
import type { AccessControlRoleRequest } from '../../../../../packages/shared/src/contracts/access-control-roles.ts';
import { AccessControlRoleServiceInstance } from './service';
export const AccessControlRoleRouter = Router();
AccessControlRoleRouter.get('/', (_req, res) => {
  res.json(AccessControlRoleServiceInstance.list());
});
AccessControlRoleRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: AccessControlRoleRequest = {
  roleName: String(payload.roleName || ''),
  permissionMatrix: String(payload.permissionMatrix || ''),
  accessScope: String(payload.accessScope || ''),
    };
    const created = AccessControlRoleServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});