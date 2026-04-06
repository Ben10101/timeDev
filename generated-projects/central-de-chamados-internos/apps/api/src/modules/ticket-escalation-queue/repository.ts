import { randomUUID } from 'crypto';
import type {
  TicketEscalationQueueActivityItem,
  TicketEscalationQueueRequest,
  TicketEscalationQueueResponse,
} from '../../../../../packages/shared/src/contracts/ticket-escalation-queue.ts';

const records: TicketEscalationQueueResponse[] = [];
const urgencyWeight: Record<string, number> = {
  critica: 0,
  alta: 1,
  moderada: 2,
  baixa: 3,
};

export class TicketEscalationQueueRepository {
  list(): TicketEscalationQueueResponse[] {
    return [...records].sort((left, right) => {
      const leftWeight = urgencyWeight[String(left.urgencyLevel || '').toLowerCase()] ?? 99;
      const rightWeight = urgencyWeight[String(right.urgencyLevel || '').toLowerCase()] ?? 99;
      if (leftWeight !== rightWeight) return leftWeight - rightWeight;
      return String(right.createdAt || '').localeCompare(String(left.createdAt || ''));
    });
  }

  activity(limit = 10): TicketEscalationQueueActivityItem[] {
    return this.list()
      .slice(0, limit)
      .map((record) => ({
        id: record.id,
        status: record.status,
        summary: `${record.ticketId} direcionado para ${record.targetTeam}`,
        createdAt: record.updatedAt || record.createdAt,
      }));
  }

  findByTicketAndTeam(ticketId: string, targetTeam: string): TicketEscalationQueueResponse | undefined {
    return records.find((record) => record.ticketId === ticketId && record.targetTeam === targetTeam);
  }

  create(input: TicketEscalationQueueRequest): TicketEscalationQueueResponse {
    const item: TicketEscalationQueueResponse = {
      id: randomUUID(),
      ticketId: input.ticketId,
      escalationReason: input.escalationReason,
      targetTeam: input.targetTeam,
      urgencyLevel: input.urgencyLevel,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    records.unshift(item);
    return item;
  }

  seed(items: TicketEscalationQueueRequest[]): void {
    for (const item of items) {
      if (!this.findByTicketAndTeam(item.ticketId, item.targetTeam)) {
        this.create(item);
      }
    }
  }
}

export const ticketEscalationQueueRepository = new TicketEscalationQueueRepository();
