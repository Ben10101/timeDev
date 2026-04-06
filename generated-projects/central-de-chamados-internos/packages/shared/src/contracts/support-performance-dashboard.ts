export interface SupportPerformanceDashboardRequest {
  categoryFilter: string;
  statusFilter: string;
  timeRange: string;
}
export interface SupportPerformanceDashboardResponse {
  id: string;
  categoryFilter: string;
  statusFilter: string;
  timeRange: string;
  status: 'draft' | 'active';
  createdAt: string;
}
export interface SupportPerformanceDashboardListResponse {
  items: SupportPerformanceDashboardResponse[];
}