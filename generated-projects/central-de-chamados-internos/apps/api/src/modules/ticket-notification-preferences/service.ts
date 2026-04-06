import pino from 'pino';
import type {
  TicketNotificationPreferenceActivityResponse,
  TicketNotificationPreferenceListResponse,
  TicketNotificationPreferenceRequest,
  TicketNotificationPreferenceResponse,
} from '../../../../../packages/shared/src/contracts/ticket-notification-preferences.ts';
import { ticketNotificationPreferenceSchema } from './schema';
import { ticketNotificationPreferencesRepository } from './repository';

const logger = pino({ name: 'ticket-notification-preferences-service' });

export class TicketNotificationPreferencesService {
  list(): TicketNotificationPreferenceListResponse {
    const items = ticketNotificationPreferencesRepository.list();
    return {
      items,
      meta: {
        mode: 'settings',
        total: items.length,
      },
    };
  }

  activity(): TicketNotificationPreferenceActivityResponse {
    return {
      items: ticketNotificationPreferencesRepository.activity(),
    };
  }

  create(input: TicketNotificationPreferenceRequest): TicketNotificationPreferenceResponse {
    const parsedInput = ticketNotificationPreferenceSchema.parse(input);
    const duplicated = ticketNotificationPreferencesRepository.findByEmail(parsedInput.notificationEmail);
    if (duplicated) {
      throw new Error('Ja existe uma configuracao para este e-mail.');
    }

    const created = ticketNotificationPreferencesRepository.create(parsedInput);
    logger.info({ notificationEmail: created.notificationEmail }, 'Preferencia de notificacao registrada');
    return created;
  }

  update(id: string, input: TicketNotificationPreferenceRequest): TicketNotificationPreferenceResponse {
    const parsedInput = ticketNotificationPreferenceSchema.parse(input);
    const duplicated = ticketNotificationPreferencesRepository.findByEmail(parsedInput.notificationEmail);
    if (duplicated && duplicated.id !== id) {
      throw new Error('Ja existe uma configuracao para este e-mail.');
    }

    const updated = ticketNotificationPreferencesRepository.update(id, parsedInput);
    logger.info({ notificationEmail: updated.notificationEmail }, 'Preferencia de notificacao atualizada');
    return updated;
  }

  buildSeedRecordsFromTask(): TicketNotificationPreferenceRequest[] {
    return [
      {
        notificationEmail: 'comercial@empresa.com',
        ticketUpdateAlerts: 'enabled',
      },
      {
        notificationEmail: 'lider.comercial@empresa.com',
        ticketUpdateAlerts: 'disabled',
      },
    ];
  }
}

export const TicketNotificationPreferenceServiceInstance = new TicketNotificationPreferencesService();
ticketNotificationPreferencesRepository.seed(TicketNotificationPreferenceServiceInstance.buildSeedRecordsFromTask());
