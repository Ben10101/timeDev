import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { SupportTicketAttachmentRequest } from '../../../../../packages/shared/src/contracts/support-ticket-attachments.ts';
import { SupportTicketAttachmentServiceInstance } from './service';

function mapValidationError(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues[0]?.message || 'Payload invalido.';
  }

  return error instanceof Error ? error.message : 'Falha ao processar a requisicao.';
}

export class SupportTicketAttachmentsController {
  list(_req: Request, res: Response) {
    res.json(SupportTicketAttachmentServiceInstance.list());
  }

  activity(_req: Request, res: Response) {
    res.json(SupportTicketAttachmentServiceInstance.activity());
  }

  create(req: Request, res: Response) {
    try {
      const payload = (req.body || {}) as SupportTicketAttachmentRequest;
      const created = SupportTicketAttachmentServiceInstance.create(payload);
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: mapValidationError(error) });
    }
  }
}

export const supportTicketAttachmentsController = new SupportTicketAttachmentsController();
