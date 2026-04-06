import type { TicketNotificationPreferenceListResponse, TicketNotificationPreferenceRequest, TicketNotificationPreferenceResponse } from '../../../../../packages/shared/src/contracts/ticket-notification-preferences.ts';

export const ticketNotificationPreferencesQueryKey = ['ticket-notification-preferences'];

export async function fetchTicketNotificationPreferenceItems(): Promise<TicketNotificationPreferenceResponse[]> {
  const response = await fetch('/api/notification-preferences');
  if (!response.ok) throw new Error('Falha ao carregar preferencias de notificacao.');
  const data: TicketNotificationPreferenceListResponse = await response.json();
  return data.items || [];
}

export async function createTicketNotificationPreference(input: TicketNotificationPreferenceRequest): Promise<TicketNotificationPreferenceResponse> {
  const response = await fetch('/api/notification-preferences', {
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
