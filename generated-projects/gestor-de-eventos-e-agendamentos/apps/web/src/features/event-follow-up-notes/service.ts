import type { EventFollowUpNoteListResponse, EventFollowUpNoteRequest, EventFollowUpNoteResponse } from '../../../../../packages/shared/src/contracts/event-follow-up-notes';
export const eventFollowUpNoteQueryKey = ['event-follow-up-notes'];
export async function fetchEventFollowUpNoteItems(): Promise<EventFollowUpNoteResponse[]> {
 const response = await fetch('/api/event-follow-up-notes');
 if (!response.ok) {
 throw new Error('Falha ao carregar registros da feature.');
 }
 const data: EventFollowUpNoteListResponse = await response.json();
 return data.items || [];
}
export async function createEventFollowUpNote(input: EventFollowUpNoteRequest): Promise<EventFollowUpNoteResponse> {
 const response = await fetch('/api/event-follow-up-notes', {
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