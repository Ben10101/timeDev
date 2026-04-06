import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AccessControlRoleRequest } from '../../../../../packages/shared/src/contracts/access-control-roles.ts';
import { AccessControlRoleServiceInstance } from './service';

function mapValidationError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message || 'Payload invalido.';
  }

  return error instanceof Error ? error.message : 'Falha ao processar a requisicao.';
}

export class AccessControlRolesController {
  list(_req: Request, res: Response) {
    res.json(AccessControlRoleServiceInstance.list());
  }

  create(req: Request, res: Response) {
    try {
      const payload = (req.body || {}) as AccessControlRoleRequest;
      const created = AccessControlRoleServiceInstance.create(payload);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: mapValidationError(error) });
    }
  }
}

export const accessControlRolesController = new AccessControlRolesController();
