import type { SupportTicketAttachmentListResponse, SupportTicketAttachmentRequest, SupportTicketAttachmentResponse } from '../../../../../packages/shared/src/contracts/support-ticket-attachments.ts';
export const supportTicketAttachmentQueryKey = ['support-ticket-attachments'];
export async function fetchSupportTicketAttachmentItems(): Promise<SupportTicketAttachmentResponse[]> {
 const response = await fetch('/api/support-ticket-attachments');
 if (!response.ok) {
 throw new Error('Falha ao carregar registros da feature.');
 }
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