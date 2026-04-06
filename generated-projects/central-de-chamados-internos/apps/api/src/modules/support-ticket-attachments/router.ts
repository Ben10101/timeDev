import { Router } from 'express';
import { supportTicketAttachmentsController } from './controller';

export const SupportTicketAttachmentRouter = Router();

SupportTicketAttachmentRouter.get('/', supportTicketAttachmentsController.list.bind(supportTicketAttachmentsController));
SupportTicketAttachmentRouter.get('/activity', supportTicketAttachmentsController.activity.bind(supportTicketAttachmentsController));
SupportTicketAttachmentRouter.post('/', supportTicketAttachmentsController.create.bind(supportTicketAttachmentsController));
