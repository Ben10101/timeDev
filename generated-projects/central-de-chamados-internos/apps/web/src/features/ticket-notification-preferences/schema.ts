import { z } from 'zod';

export const ticketNotificationPreferenceFormSchema = z.object({
  notificationEmail: z.string().trim().email('Use um e-mail valido para notificacoes.'),
  ticketUpdateAlerts: z.enum(['enabled', 'disabled'], {
    message: 'Escolha um estado valido para os alertas.',
  }),
});

export type TicketNotificationPreferenceFormValues = z.infer<typeof ticketNotificationPreferenceFormSchema>;
