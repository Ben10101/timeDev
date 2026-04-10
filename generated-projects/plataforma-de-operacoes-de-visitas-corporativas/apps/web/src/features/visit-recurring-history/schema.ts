import { z } from 'zod';
export const visitRecurringHistoryFormSchema = z.object({
 clientIdentifier: z.string().trim().min(5, 'Informe CPF, CNPJ ou ID do cliente para localizar visitas anteriores.'),
 periodRange: z.enum(['ultimos_3_meses', 'ultimos_6_meses', 'ultimos_12_meses'], { message: 'Defina o recorte temporal usado para consultar o historico recorrente.' }),
 visitStatus: z.enum(['realizada', 'concluida'], { message: 'Mostre apenas visitas realmente aproveitaveis para o novo agendamento.' }),
});
export type VisitRecurringHistoryFormValues = z.infer<typeof visitRecurringHistoryFormSchema>;