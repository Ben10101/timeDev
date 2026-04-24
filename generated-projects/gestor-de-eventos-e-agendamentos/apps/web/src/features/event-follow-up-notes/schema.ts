import { z } from 'zod';
export const eventFollowUpNoteFormSchema = z.object({
 eventId: z.string().trim().min(1, 'Informe o identificador do evento ao qual a observacao sera vinculada.'),
 noteText: z.string().trim().min(10, 'Registre a nota de contexto que ajuda a explicar prioridades, riscos ou pendencias do evento.'),
});
export type EventFollowUpNoteFormValues = z.infer<typeof eventFollowUpNoteFormSchema>;