import { randomUUID } from 'crypto';
import type { SupportTicketAttachmentListResponse, SupportTicketAttachmentRequest, SupportTicketAttachmentResponse } from '../../../../../packages/shared/src/contracts/support-ticket-attachments.ts';
const records: SupportTicketAttachmentResponse[] = [];
/**
 * - O documento anexado deve permanecer vinculado ao chamado correto para consulta durante o atendimento.
 * - O tipo do documento precisa indicar se o anexo e fiscal, comprovante ou outro apoio operacional.
 * - O anexo precisa registrar uma referencia acessivel para que o suporte consulte o documento sem retrabalho.
 */
export class SupportTicketAttachmentsService {
  list(): SupportTicketAttachmentListResponse {
    return { items: records };
  }
  create(input: SupportTicketAttachmentRequest): SupportTicketAttachmentResponse {
    const item: SupportTicketAttachmentResponse = {
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
  buildSeedFromTask(): SupportTicketAttachmentRequest {
    return {
      documentType: 'comprovante',
      documentDescription: 'Comprovante referente ao pagamento associado ao chamado aberto pelo financeiro.',
      fileUrl: 'https://arquivos.empresa.com/documentos/comprovante.pdf',
    };
  }
}
export const SupportTicketAttachmentServiceInstance = new SupportTicketAttachmentsService();
records.push(SupportTicketAttachmentServiceInstance.create(SupportTicketAttachmentServiceInstance.buildSeedFromTask()));