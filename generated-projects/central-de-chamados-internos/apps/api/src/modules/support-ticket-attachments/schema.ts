import { z } from 'zod';

export const supportTicketAttachmentSchema = z.object({
  documentType: z.enum(['nota_fiscal', 'comprovante', 'recibo', 'contrato', 'outro'], {
    message: 'Tipo de documento invalido.',
  }),
  documentDescription: z.string().trim().min(10, 'Descreva melhor o contexto do anexo.'),
  fileUrl: z.string().trim().url('Informe um arquivo ou link valido para o documento.'),
});

export type SupportTicketAttachmentInput = z.infer<typeof supportTicketAttachmentSchema>;
