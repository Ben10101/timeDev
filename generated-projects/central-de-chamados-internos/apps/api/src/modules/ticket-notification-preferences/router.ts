import { Router } from 'express';
import type { TicketNotificationPreferenceRequest } from '../../../../../packages/shared/src/contracts/ticket-notification-preferences.ts';
import { TicketNotificationPreferenceServiceInstance } from './service';
export const TicketNotificationPreferenceRouter = Router();
TicketNotificationPreferenceRouter.get('/', (_req, res) => {
  res.json(TicketNotificationPreferenceServiceInstance.list());
});
TicketNotificationPreferenceRouter.post('/', (req, res) => {
  try {
    const payload = req.body || {};
    const input: TicketNotificationPreferenceRequest = {
  notificationEmail: String(payload.notificationEmail || ''),
  ticketUpdateAlerts: String(payload.ticketUpdateAlerts || ''),
    };
    const created = TicketNotificationPreferenceServiceInstance.create(input);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ message: error instanceof Error ? error.message : 'Falha ao processar a requisicao.' });
  }
});