import { z } from 'zod';
export const supportTicketAttachmentFormSchema = z.object({
 documentType: z.enum(['nota_fiscal', 'comprovante', 'recibo', 'contrato', 'outro'], { message: 'Classifique o anexo para facilitar a triagem do chamado.' }),
 documentDescription: z.string().trim().min(10, 'Explique rapidamente por que este documento ajuda no atendimento.'),
 fileUrl: z.string().trim().url('Informe a URL do arquivo salvo para que o time de suporte consiga acessar o documento.').min(1, 'Informe a URL do arquivo salvo para que o time de suporte consiga acessar o documento.'),
});
export type SupportTicketAttachmentFormValues = z.infer<typeof supportTicketAttachmentFormSchema>;