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
}
export interface SupportTicketAttachmentListResponse {
  items: SupportTicketAttachmentResponse[];
}