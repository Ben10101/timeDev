import pino from 'pino';
import type {
  SupportTicketAttachmentActivityResponse,
  SupportTicketAttachmentListResponse,
  SupportTicketAttachmentRequest,
  SupportTicketAttachmentResponse,
} from '../../../../../packages/shared/src/contracts/support-ticket-attachments.ts';
import { supportTicketAttachmentSchema } from './schema';
import { supportTicketAttachmentsRepository } from './repository';

const logger = pino({ name: 'support-ticket-attachments-service' });

export class SupportTicketAttachmentsService {
  list(): SupportTicketAttachmentListResponse {
    const items = supportTicketAttachmentsRepository.list();
    return {
      items,
      meta: {
        mode: 'evidence',
        total: items.length,
      },
    };
  }

  activity(): SupportTicketAttachmentActivityResponse {
    return {
      items: supportTicketAttachmentsRepository.activity(),
    };
  }

  create(input: SupportTicketAttachmentRequest): SupportTicketAttachmentResponse {
    const parsedInput = supportTicketAttachmentSchema.parse(input);
    const created = supportTicketAttachmentsRepository.create(parsedInput);
    logger.info({ documentType: created.documentType, fileUrl: created.fileUrl }, 'Evidencia anexada ao caso');
    return created;
  }

  buildSeedRecordsFromTask(): SupportTicketAttachmentRequest[] {
    return [
      {
        documentType: 'nota_fiscal',
        documentDescription: 'Nota fiscal referente ao servico contratado para o chamado financeiro.',
        fileUrl: 'https://arquivos.empresa.com/documentos/nota-fiscal-4821.pdf',
      },
      {
        documentType: 'comprovante',
        documentDescription: 'Comprovante de pagamento usado para validar a solicitacao do colaborador.',
        fileUrl: 'https://arquivos.empresa.com/documentos/comprovante-pagamento-abril.pdf',
      },
      {
        documentType: 'contrato',
        documentDescription: 'Contrato enviado para contextualizar a origem da cobranca questionada.',
        fileUrl: 'https://arquivos.empresa.com/documentos/contrato-suporte.pdf',
      },
    ];
  }
}

export const SupportTicketAttachmentServiceInstance = new SupportTicketAttachmentsService();
supportTicketAttachmentsRepository.seed(SupportTicketAttachmentServiceInstance.buildSeedRecordsFromTask());
