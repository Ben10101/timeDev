import { randomUUID } from 'crypto';
import type { TicketNotificationPreferenceListResponse, TicketNotificationPreferenceRequest, TicketNotificationPreferenceResponse } from '../../../../../packages/shared/src/contracts/ticket-notification-preferences.ts';
const records: TicketNotificationPreferenceResponse[] = [];
/**
 * - O sistema nao deve permitir registros com e-mail duplicado.
 * - O e-mail deve ser validado antes do envio para persistencia.
 */
export class TicketNotificationPreferencesService {
  list(): TicketNotificationPreferenceListResponse {
    return { items: records };
  }
  create(input: TicketNotificationPreferenceRequest): TicketNotificationPreferenceResponse {
    const item: TicketNotificationPreferenceResponse = {
      id: randomUUID(),
      notificationEmail: input.notificationEmail,
      ticketUpdateAlerts: input.ticketUpdateAlerts,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    records.push(item);
    return item;
  }
  buildSeedFromTask(): TicketNotificationPreferenceRequest {
    return {
      notificationEmail: 'comercial@empresa.com',
      ticketUpdateAlerts: 'enabled',
    };
  }
}
export const TicketNotificationPreferenceServiceInstance = new TicketNotificationPreferencesService();
records.push(TicketNotificationPreferenceServiceInstance.create(TicketNotificationPreferenceServiceInstance.buildSeedFromTask()));