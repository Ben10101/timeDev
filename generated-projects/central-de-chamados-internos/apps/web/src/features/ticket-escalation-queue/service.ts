import type {
  TicketEscalationQueueListResponse,
  TicketEscalationQueueRequest,
  TicketEscalationQueueResponse,
} from '../../../../../packages/shared/src/contracts/ticket-escalation-queue.ts';

export const ticketEscalationQueueQueryKey = ['ticket-escalation-queue'];

export async function fetchTicketEscalationQueueItems(): Promise<TicketEscalationQueueResponse[]> {
  const response = await fetch('/api/ticket-escalations');
  if (!response.ok) {
    throw new Error('Falha ao carregar fila de escalonamentos.');
  }
  const data: TicketEscalationQueueListResponse = await response.json();
  return data.items || [];
}

export async function createTicketEscalationQueueItem(
  input: TicketEscalationQueueRequest
): Promise<TicketEscalationQueueResponse> {
  const response = await fetch('/api/ticket-escalations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Falha ao criar escalonamento.' }));
    throw new Error(error.message || 'Falha ao criar escalonamento.');
  }

  return response.json();
}
