import { z } from 'zod';
export const visitExtraCompanionFormSchema = z.object({
 approvedVisitCode: z.string().trim().min(5, 'Informe o identificador da visita ja aprovada para vincular o acompanhante extra ao registro correto.'),
 companionName: z.string().trim().min(3, 'Registre o nome de quem sera incluido na mesma visita aprovada.'),
 securityFastApproval: z.enum(['pendente', 'aprovado'], { message: 'Indique a decisao rapida da seguranca para liberar a inclusao sem reiniciar o fluxo completo.' }),
});
export type VisitExtraCompanionFormValues = z.infer<typeof visitExtraCompanionFormSchema>;