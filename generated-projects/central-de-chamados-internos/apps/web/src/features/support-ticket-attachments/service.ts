import type { SupportTicketAttachmentListResponse, SupportTicketAttachmentRequest, SupportTicketAttachmentResponse } from '../../../../../packages/shared/src/contracts/support-ticket-attachments.ts';
export async function fetchSupportTicketAttachmentItems(): Promise<SupportTicketAttachmentResponse[]> {
 const response = await fetch('/api/support-ticket-attachments');
 const data: SupportTicketAttachmentListResponse = await response.json();
 return data.items || [];
}
export async function createSupportTicketAttachment(input: SupportTicketAttachmentRequest): Promise<SupportTicketAttachmentResponse> {
 const response = await fetch('/api/support-ticket-attachments', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(input),
 });
 if (!response.ok) {
 const error = await response.json().catch(() => ({ message: 'Falha ao criar registro.' }));
 throw new Error(error.message || 'Falha ao criar registro.');
 }
 return response.json();
}