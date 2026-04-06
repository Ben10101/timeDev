import { z } from 'zod';

export const supportPerformanceDashboardFormSchema = z.object({
  categoryFilter: z.enum(['geral', 'financeiro', 'acesso', 'infraestrutura', 'comercial'], {
    message: 'Escolha uma categoria valida.',
  }),
  statusFilter: z.enum(['aberto', 'em_atendimento', 'aguardando', 'resolvido'], {
    message: 'Escolha um status valido.',
  }),
  timeRange: z.enum(['ultimos_7_dias', 'mes_atual', 'ultimos_30_dias', 'trimestre'], {
    message: 'Escolha um periodo valido.',
  }),
});

export type SupportPerformanceDashboardFormValues = z.infer<typeof supportPerformanceDashboardFormSchema>;
