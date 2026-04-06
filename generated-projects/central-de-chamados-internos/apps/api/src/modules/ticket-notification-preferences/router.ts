import { Router } from 'express';
import { ticketNotificationPreferencesController } from './controller';

export const TicketNotificationPreferenceRouter = Router();

TicketNotificationPreferenceRouter.get('/', ticketNotificationPreferencesController.list.bind(ticketNotificationPreferencesController));
TicketNotificationPreferenceRouter.get('/activity', ticketNotificationPreferencesController.activity.bind(ticketNotificationPreferencesController));
TicketNotificationPreferenceRouter.post('/', ticketNotificationPreferencesController.create.bind(ticketNotificationPreferencesController));
TicketNotificationPreferenceRouter.put('/:id', ticketNotificationPreferencesController.update.bind(ticketNotificationPreferencesController));
