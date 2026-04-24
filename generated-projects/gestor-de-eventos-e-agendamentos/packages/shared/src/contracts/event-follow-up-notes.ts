export interface EventFollowUpNoteRequest {
  eventId: string;
  noteText: string;
}
export interface EventFollowUpNoteResponse {
  id: number | string;
  eventId: string;
  noteText: string;
  status: 'draft' | 'active';
  createdAt: string;
}
export interface EventFollowUpNoteListResponse {
  items: EventFollowUpNoteResponse[];
}