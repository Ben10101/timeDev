import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { SupportPerformanceDashboardRequest } from '../../../../../packages/shared/src/contracts/support-performance-dashboard.ts';
import { SupportPerformanceDashboardServiceInstance } from './service';

function mapValidationError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message || 'Payload invalido.';
  }

  return error instanceof Error ? error.message : 'Falha ao processar a requisicao.';
}

export class SupportPerformanceDashboardController {
  list(_req: Request, res: Response) {
    res.json(SupportPerformanceDashboardServiceInstance.list());
  }

  create(req: Request, res: Response) {
    try {
      const payload = (req.body || {}) as SupportPerformanceDashboardRequest;
      const created = SupportPerformanceDashboardServiceInstance.create(payload);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: mapValidationError(error) });
    }
  }
}

export const supportPerformanceDashboardController = new SupportPerformanceDashboardController();
