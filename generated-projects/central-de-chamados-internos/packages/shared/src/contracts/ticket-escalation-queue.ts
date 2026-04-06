export interface TicketEscalationQueueRequest {
  ticketId: string;
  escalationReason: string;
  targetTeam: string;
  urgencyLevel: string;
}

export interface TicketEscalationQueueResponse {
  id: string;
  ticketId: string;
  escalationReason: string;
  targetTeam: string;
  urgencyLevel: string;
  status: 'draft' | 'active';
  createdAt: string;
  updatedAt?: string;
}

export interface TicketEscalationQueueListResponse {
  items: TicketEscalationQueueResponse[];
  meta?: {
    mode: 'queue';
    total: number;
    sort: 'prioritySort';
  };
}

export interface TicketEscalationQueueActivityItem {
  id: string;
  status: 'draft' | 'active';
  summary: string;
  createdAt: string;
}

export interface TicketEscalationQueueActivityResponse {
  items: TicketEscalationQueueActivityItem[];
}
