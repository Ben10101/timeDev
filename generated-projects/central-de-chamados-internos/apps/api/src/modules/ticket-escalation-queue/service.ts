import pino from 'pino';
import type {
  TicketEscalationQueueActivityResponse,
  TicketEscalationQueueListResponse,
  TicketEscalationQueueRequest,
  TicketEscalationQueueResponse,
} from '../../../../../packages/shared/src/contracts/ticket-escalation-queue.ts';
import { ticketEscalationQueueSchema } from './schema';
import { ticketEscalationQueueRepository } from './repository';

const logger = pino({ name: 'ticket-escalation-queue-service' });

export class TicketEscalationQueueService {
  list(): TicketEscalationQueueListResponse {
    const items = ticketEscalationQueueRepository.list();
    return {
      items,
      meta: {
        mode: 'queue',
        total: items.length,
        sort: 'prioritySort',
      },
    };
  }

  activity(): TicketEscalationQueueActivityResponse {
    return {
      items: ticketEscalationQueueRepository.activity(),
    };
  }

  create(input: TicketEscalationQueueRequest): TicketEscalationQueueResponse {
    const parsedInput = ticketEscalationQueueSchema.parse(input);
    const duplicatedEscalation = ticketEscalationQueueRepository.findByTicketAndTeam(
      parsedInput.ticketId,
      parsedInput.targetTeam
    );

    if (duplicatedEscalation) {
      throw new Error('Ja existe um escalonamento aberto para esse chamado nesse time.');
    }

    const created = ticketEscalationQueueRepository.create(parsedInput);
    logger.info(
      { ticketId: created.ticketId, targetTeam: created.targetTeam, urgencyLevel: created.urgencyLevel },
      'Escalonamento registrado para a fila operacional'
    );
    return created;
  }

  buildSeedRecordsFromTask(): TicketEscalationQueueRequest[] {
    return [
      {
        ticketId: 'CH-2048',
        escalationReason: 'Cliente VIP aguardando retorno ha mais de duas horas com impacto financeiro direto.',
        targetTeam: 'financeiro',
        urgencyLevel: 'alta',
      },
      {
        ticketId: 'CH-2079',
        escalationReason: 'Falha intermitente de VPN esta impedindo o acesso do time comercial ao CRM.',
        targetTeam: 'infraestrutura',
        urgencyLevel: 'critica',
      },
      {
        ticketId: 'CH-2091',
        escalationReason: 'Tentativas repetidas de redefinicao de senha sugerem bloqueio indevido de acesso.',
        targetTeam: 'seguranca',
        urgencyLevel: 'moderada',
      },
    ];
  }
}

export const TicketEscalationQueueServiceInstance = new TicketEscalationQueueService();
ticketEscalationQueueRepository.seed(TicketEscalationQueueServiceInstance.buildSeedRecordsFromTask());
