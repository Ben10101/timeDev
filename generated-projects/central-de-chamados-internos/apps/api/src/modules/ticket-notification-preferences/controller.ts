import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { TicketNotificationPreferenceRequest } from '../../../../../packages/shared/src/contracts/ticket-notification-preferences.ts';
import { TicketNotificationPreferenceServiceInstance } from './service';

function mapValidationError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message || 'Payload invalido.';
  }

  return error instanceof Error ? error.message : 'Falha ao processar a requisicao.';
}

export class TicketNotificationPreferencesController {
  list(_req: Request, res: Response) {
    res.json(TicketNotificationPreferenceServiceInstance.list());
  }

  activity(_req: Request, res: Response) {
    res.json(TicketNotificationPreferenceServiceInstance.activity());
  }

  create(req: Request, res: Response) {
    try {
      const payload = (req.body || {}) as TicketNotificationPreferenceRequest;
      const created = TicketNotificationPreferenceServiceInstance.create(payload);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: mapValidationError(error) });
    }
  }

  update(req: Request, res: Response) {
    try {
      const payload = (req.body || {}) as TicketNotificationPreferenceRequest;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const updated = TicketNotificationPreferenceServiceInstance.update(String(id || ''), payload);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ message: mapValidationError(error) });
    }
  }
}

export const ticketNotificationPreferencesController = new TicketNotificationPreferencesController();
