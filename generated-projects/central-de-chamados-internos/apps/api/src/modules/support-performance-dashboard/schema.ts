import { z } from 'zod';

export const supportPerformanceDashboardSchema = z.object({
  categoryFilter: z.enum(['geral', 'financeiro', 'acesso', 'infraestrutura', 'comercial'], {
    message: 'Categoria invalida.',
  }),
  statusFilter: z.enum(['aberto', 'em_atendimento', 'aguardando', 'resolvido'], {
    message: 'Status invalido.',
  }),
  timeRange: z.enum(['ultimos_7_dias', 'mes_atual', 'ultimos_30_dias', 'trimestre'], {
    message: 'Periodo invalido.',
  }),
});

export type SupportPerformanceDashboardInput = z.infer<typeof supportPerformanceDashboardSchema>;
