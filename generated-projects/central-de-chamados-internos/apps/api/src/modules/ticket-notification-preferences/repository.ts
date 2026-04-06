import { randomUUID } from 'crypto';
import type {
  TicketNotificationPreferenceActivityItem,
  TicketNotificationPreferenceRequest,
  TicketNotificationPreferenceResponse,
} from '../../../../../packages/shared/src/contracts/ticket-notification-preferences.ts';

const records: TicketNotificationPreferenceResponse[] = [];

export class TicketNotificationPreferencesRepository {
  list(): TicketNotificationPreferenceResponse[] {
    return [...records].sort((left, right) => String(right.updatedAt || right.createdAt).localeCompare(String(left.updatedAt || left.createdAt)));
  }

  activity(limit = 10): TicketNotificationPreferenceActivityItem[] {
    return this.list()
      .slice(0, limit)
      .map((record) => ({
        id: record.id,
        status: record.status,
        summary: `${record.notificationEmail} com alertas ${record.ticketUpdateAlerts}`,
        createdAt: record.updatedAt || record.createdAt,
      }));
  }

  findByEmail(email: string): TicketNotificationPreferenceResponse | undefined {
    return records.find((record) => record.notificationEmail === email);
  }

  create(input: TicketNotificationPreferenceRequest): TicketNotificationPreferenceResponse {
    const item: TicketNotificationPreferenceResponse = {
      id: randomUUID(),
      notificationEmail: input.notificationEmail,
      ticketUpdateAlerts: input.ticketUpdateAlerts,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    records.unshift(item);
    return item;
  }

  update(id: string, input: TicketNotificationPreferenceRequest): TicketNotificationPreferenceResponse {
    const record = records.find((item) => item.id === id);
    if (!record) {
      throw new Error('Configuracao de notificacao nao encontrada.');
    }

    record.notificationEmail = input.notificationEmail;
    record.ticketUpdateAlerts = input.ticketUpdateAlerts;
    record.updatedAt = new Date().toISOString();

    return record;
  }

  seed(items: TicketNotificationPreferenceRequest[]): void {
    for (const item of items) {
      if (!this.findByEmail(item.notificationEmail)) {
        this.create(item);
      }
    }
  }
}

export const ticketNotificationPreferencesRepository = new TicketNotificationPreferencesRepository();
