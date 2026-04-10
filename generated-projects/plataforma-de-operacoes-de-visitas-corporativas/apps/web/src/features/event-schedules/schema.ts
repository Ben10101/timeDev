import { z } from 'zod';
export const eventScheduleFormSchema = z.object({
 stageName: z.string().trim().min(3, 'Nomeie a etapa principal para deixar o plano facil de acompanhar.'),
 plannedDeadline: z.string().trim().min(1, 'Defina a data alvo dessa etapa para dar previsibilidade ao time.'),
 executionNotes: z.string().trim().min(10, 'Registre o contexto minimo da etapa para facilitar a execucao e o handoff.'),
});
export type EventScheduleFormValues = z.infer<typeof eventScheduleFormSchema>;