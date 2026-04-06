import { z } from 'zod';

export const supportTicketAttachmentFormSchema = z.object({
  documentType: z.enum(['nota_fiscal', 'comprovante', 'recibo', 'contrato', 'outro'], {
    message: 'Escolha um tipo de documento valido.',
  }),
  documentDescription: z.string().trim().min(10, 'Descreva melhor o contexto do anexo.'),
  fileUrl: z.string().trim().url('Informe um arquivo ou link valido para o documento.'),
});

export type SupportTicketAttachmentFormValues = z.infer<typeof supportTicketAttachmentFormSchema>;
