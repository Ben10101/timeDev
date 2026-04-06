import { randomUUID } from 'crypto';
import type { SupportTicketAttachmentRequest, SupportTicketAttachmentResponse } from '../../../../../packages/shared/src/contracts/support-ticket-attachments.ts';
type InternalRecord = SupportTicketAttachmentResponse & {
  updatedAt?: string;
  reviewDecision?: 'approved' | 'rejected';
  reviewNote?: string;
  attachmentCount?: number;
  latestAttachment?: string;
  priority?: string;
  title?: string;
  name?: string;
  subject?: string;
};
const records: InternalRecord[] = [];
function validateInput(input: SupportTicketAttachmentRequest, existingRecords: SupportTicketAttachmentResponse[]): void {
  if (!String(input.documentType || '').trim()) throw new Error('Tipo de documento obrigatorio.');
  if (!["nota_fiscal","comprovante","recibo","contrato","outro"].includes(String(input.documentType))) throw new Error('Tipo de documento invalido.');
  if (!String(input.documentDescription || '').trim()) throw new Error('Descricao do anexo obrigatorio.');
  if (String(input.documentDescription || '').trim().length < 10) throw new Error('Descricao do anexo deve ter ao menos 10 caracteres.');
  if (!String(input.fileUrl || '').trim()) throw new Error('Arquivo ou link do comprovante obrigatorio.');
  if (!/^https?:\/\//.test(String(input.fileUrl || ''))) throw new Error('Arquivo ou link do comprovante invalido.');
  if (String(input.documentDescription || '').trim().length < 10) throw new Error('Descreva melhor o contexto do anexo.');
  if (!/^https?:\/\//.test(String(input.fileUrl || ''))) throw new Error('Informe um arquivo ou link valido para o documento.');
}
/**
 * - O documento anexado deve permanecer vinculado ao chamado correto para consulta durante o atendimento.
 */
export class SupportTicketAttachmentsService {
  list() {
    return { items: records };
  }
  create(input: SupportTicketAttachmentRequest): SupportTicketAttachmentResponse {
    validateInput(input, records);
    const item: InternalRecord = {
      id: randomUUID(),
      documentType: input.documentType,
      documentDescription: input.documentDescription,
      fileUrl: input.fileUrl,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    records.push(item);
    return item;
  }
  buildSeedRecordsFromTask(): SupportTicketAttachmentRequest[] {
    return [
  {
    documentType: 'nota_fiscal',
    documentDescription: 'Nota fiscal referente ao servico contratado para o chamado financeiro.',
    fileUrl: 'https://arquivos.empresa.com/documentos/nota-fiscal-4821.pdf'
  },
  {
    documentType: 'comprovante',
    documentDescription: 'Comprovante de pagamento usado para validar a solicitacao do colaborador.',
    fileUrl: 'https://arquivos.empresa.com/documentos/comprovante-pagamento-abril.pdf'
  },
  {
    documentType: 'contrato',
    documentDescription: 'Contrato enviado para contextualizar a origem da cobranca questionada.',
    fileUrl: 'https://arquivos.empresa.com/documentos/contrato-suporte.pdf'
  }
];
  }
}
export const SupportTicketAttachmentServiceInstance = new SupportTicketAttachmentsService();
for (const seedInput of SupportTicketAttachmentServiceInstance.buildSeedRecordsFromTask()) {
  records.push(SupportTicketAttachmentServiceInstance.create(seedInput));
}