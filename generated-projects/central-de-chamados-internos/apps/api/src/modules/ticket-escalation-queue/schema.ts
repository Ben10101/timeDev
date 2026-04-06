import { z } from 'zod';

export const ticketEscalationQueueSchema = z.object({
  ticketId: z
    .string()
    .trim()
    .min(4, 'Informe o identificador do chamado para abrir o escalonamento.'),
  escalationReason: z
    .string()
    .trim()
    .min(12, 'Explique melhor o motivo do escalonamento.'),
  targetTeam: z.enum(['financeiro', 'infraestrutura', 'seguranca', 'plataforma'], {
    message: 'Escolha um time valido para receber o escalonamento.',
  }),
  urgencyLevel: z.enum(['moderada', 'alta', 'critica'], {
    message: 'Escolha um nivel de urgencia valido.',
  }),
});

export type TicketEscalationQueueInput = z.infer<typeof ticketEscalationQueueSchema>;
