export interface EventScheduleRequest {
  stageName: string;
  plannedDeadline: string;
  executionNotes: string;
}
export interface EventScheduleResponse {
  id: number | string;
  stageName: string;
  plannedDeadline: string;
  executionNotes: string;
  status: 'draft' | 'active';
  createdAt: string;
}
export interface EventScheduleListResponse {
  items: EventScheduleResponse[];
}