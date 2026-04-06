export interface SupportTicketAttachmentRequest {
  documentType: string;
  documentDescription: string;
  fileUrl: string;
}
export interface SupportTicketAttachmentResponse {
  id: string;
  documentType: string;
  documentDescription: string;
  fileUrl: string;
  status: 'draft' | 'active';
  createdAt: string;
  updatedAt?: string;
}
export interface SupportTicketAttachmentListResponse {
  items: SupportTicketAttachmentResponse[];
  meta?: {
    mode: 'evidence';
    total: number;
  };
}

export interface SupportTicketAttachmentActivityItem {
  id: string;
  status: 'draft' | 'active';
  summary: string;
  createdAt: string;
}

export interface SupportTicketAttachmentActivityResponse {
  items: SupportTicketAttachmentActivityItem[];
}
