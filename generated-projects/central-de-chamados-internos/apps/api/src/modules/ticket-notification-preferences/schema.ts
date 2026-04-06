import { z } from 'zod';

export const ticketNotificationPreferenceSchema = z.object({
  notificationEmail: z.string().trim().email('E-mail para notificacoes invalido.'),
  ticketUpdateAlerts: z.enum(['enabled', 'disabled'], {
    message: 'Notificar atualizacoes do chamado invalido.',
  }),
});

export type TicketNotificationPreferenceInput = z.infer<typeof ticketNotificationPreferenceSchema>;
