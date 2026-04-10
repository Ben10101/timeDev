export interface VisitRecurringHistoryRequest {
  clientIdentifier: string;
  periodRange: string;
  visitStatus: string;
}
export interface VisitRecurringHistoryResponse {
  id: number | string;
  clientIdentifier: string;
  periodRange: string;
  visitStatus: string;
  status: 'draft' | 'active';
  createdAt: string;
}
export interface VisitRecurringHistoryListResponse {
  items: VisitRecurringHistoryResponse[];
}