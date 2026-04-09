import { z } from 'zod';
export const visitOperationalResponsibleFormSchema = z.object({
 responsibleName: z.string().trim().min(3, 'Informe o nome de quem apoia a operacao desta visita.'),
 contact: z.string().trim().min(1, 'Registre um e-mail ou telefone com DDD para acionamento rapido.'),
 supportType: z.enum(['tecnico', 'logistica', 'seguranca', 'apoio'], { message: 'Selecione o tipo principal de apoio prestado por este responsavel.' }),
});
export type VisitOperationalResponsibleFormValues = z.infer<typeof visitOperationalResponsibleFormSchema>;