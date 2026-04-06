import { Router } from 'express';
import type { SupportTicketAttachmentRequest } from '../../../../../packages/shared/src/contracts/support-ticket-attachments.ts';
import { SupportTicketAttachmentServiceInstance } from './service';
export const SupportTicketAttachmentRouter = Router();
SupportTicketAttachmentRouter.get('/', (_req, res) => {
  res.json(SupportTicketAttachmentServiceInstance.list());
});
SupportTicketAttachmentRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: SupportTicketAttachmentRequest = {
  documentType: String(payload.documentType || ''),
  documentDescription: String(payload.documentDescription || ''),
  fileUrl: String(payload.fileUrl || ''),
    };
    const created = SupportTicketAttachmentServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});