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
  updatedAt?: string;
}
export interface TicketNotificationPreferenceListResponse {
  items: TicketNotificationPreferenceResponse[];
  meta?: {
    mode: 'settings';
    total: number;
  };
}

export interface TicketNotificationPreferenceActivityItem {
  id: string;
  status: 'draft' | 'active';
  summary: string;
  createdAt: string;
}

export interface TicketNotificationPreferenceActivityResponse {
  items: TicketNotificationPreferenceActivityItem[];
}
