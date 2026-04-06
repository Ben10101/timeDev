import { randomUUID } from 'crypto';
import type {
  SupportTicketAttachmentActivityItem,
  SupportTicketAttachmentRequest,
  SupportTicketAttachmentResponse,
} from '../../../../../packages/shared/src/contracts/support-ticket-attachments.ts';

const records: SupportTicketAttachmentResponse[] = [];

export class SupportTicketAttachmentsRepository {
  list(): SupportTicketAttachmentResponse[] {
    return [...records].sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt)));
  }

  activity(limit = 10): SupportTicketAttachmentActivityItem[] {
    return this.list()
      .slice(0, limit)
      .map((record) => ({
        id: record.id,
        status: record.status,
        summary: `${record.documentType} anexado para validacao do caso`,
        createdAt: record.updatedAt || record.createdAt,
      }));
  }

  create(input: SupportTicketAttachmentRequest): SupportTicketAttachmentResponse {
    const item: SupportTicketAttachmentResponse = {
      id: randomUUID(),
      documentType: input.documentType,
      documentDescription: input.documentDescription,
      fileUrl: input.fileUrl,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    records.unshift(item);
    return item;
  }

  seed(items: SupportTicketAttachmentRequest[]): void {
    for (const item of items) {
      if (!records.find((record) => record.fileUrl === item.fileUrl)) {
        this.create(item);
      }
    }
  }
}

export const supportTicketAttachmentsRepository = new SupportTicketAttachmentsRepository();
