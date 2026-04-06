import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { TicketEscalationQueueRequest } from '../../../../../packages/shared/src/contracts/ticket-escalation-queue.ts';
import { TicketEscalationQueueServiceInstance } from './service';

function mapValidationError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message || 'Payload invalido.';
  }

  return error instanceof Error ? error.message : 'Falha ao processar a requisicao.';
}

export class TicketEscalationQueueController {
  list(_req: Request, res: Response) {
    res.json(TicketEscalationQueueServiceInstance.list());
  }

  activity(_req: Request, res: Response) {
    res.json(TicketEscalationQueueServiceInstance.activity());
  }

  create(req: Request, res: Response) {
    try {
      const payload = (req.body || {}) as TicketEscalationQueueRequest;
      const created = TicketEscalationQueueServiceInstance.create(payload);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: mapValidationError(error) });
    }
  }
}

export const ticketEscalationQueueController = new TicketEscalationQueueController();
