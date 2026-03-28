export interface TicketNotificationPreferenceRequest {
  notificationEmail: string;
  ticketUpdateAlerts: string;
}
export interface TicketNotificationPreferenceResponse {
  id: string;
  notificationEmail: string;
  ticketUpdateAlerts: string;
  status: 'draft' | 'active';
  createdAt: string;
}
export interface TicketNotificationPreferenceListResponse {
  items: TicketNotificationPreferenceResponse[];
}