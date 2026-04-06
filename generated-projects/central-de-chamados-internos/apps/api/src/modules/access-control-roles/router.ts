import { Router } from 'express';
import { accessControlRolesController } from './controller';
export const AccessControlRoleRouter = Router();
AccessControlRoleRouter.get('/', accessControlRolesController.list.bind(accessControlRolesController));
AccessControlRoleRouter.post('/', accessControlRolesController.create.bind(accessControlRolesController));
