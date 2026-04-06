import { Router } from 'express';
import { ticketEscalationQueueController } from './controller';

export const TicketEscalationQueueRouter = Router();

TicketEscalationQueueRouter.get('/', ticketEscalationQueueController.list.bind(ticketEscalationQueueController));
TicketEscalationQueueRouter.get('/activity', ticketEscalationQueueController.activity.bind(ticketEscalationQueueController));
TicketEscalationQueueRouter.post('/', ticketEscalationQueueController.create.bind(ticketEscalationQueueController));
