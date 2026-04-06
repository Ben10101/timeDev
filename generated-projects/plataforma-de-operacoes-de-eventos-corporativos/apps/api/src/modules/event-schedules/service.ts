import { randomUUID } from 'crypto';
import type { EventScheduleRequest, EventScheduleResponse } from '../../../../../packages/shared/src/contracts/event-schedules.ts';
type InternalRecord = EventScheduleResponse & {
  updatedAt?: string;
  reviewDecision?: 'approved' | 'rejected';
  reviewNote?: string;
  attachmentCount?: number;
  latestAttachment?: string;
  priority?: string;
  title?: string;
  name?: string;
  subject?: string;
};
const records: InternalRecord[] = [];
function validateInput(input: EventScheduleRequest, existingRecords: EventScheduleResponse[]): void {
  if (!String(input.stageName || '').trim()) throw new Error('Etapa do cronograma obrigatorio.');
  if (String(input.stageName || '').trim().length < 3) throw new Error('Etapa do cronograma deve ter ao menos 3 caracteres.');
  if (!String(input.plannedDeadline || '').trim()) throw new Error('Prazo planejado obrigatorio.');
  if (!String(input.executionNotes || '').trim()) throw new Error('Notas operacionais obrigatorio.');
  if (String(input.executionNotes || '').trim().length < 10) throw new Error('Notas operacionais deve ter ao menos 10 caracteres.');
  const duplicatedStage = records.find((record) => String(record.stageName || '').toLowerCase() === String(input.stageName || '').toLowerCase());
  if (duplicatedStage) throw new Error('Ja existe uma etapa cadastrada com este nome no cronograma.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.plannedDeadline || ''))) throw new Error('Informe um prazo planejado valido para a etapa.');
  if (String(input.executionNotes || '').trim().length < 10) throw new Error('Descreva melhor o contexto operacional desta etapa.');
}
/**
 * - Cada etapa do cronograma precisa ter um nome claro para facilitar acompanhamento e comunicacao entre os times.
 * - O cronograma inicial deve registrar um prazo planejado para cada etapa antes da execucao do evento.
 * - As notas operacionais precisam trazer contexto suficiente para orientar handoff e preparo da etapa.
 */
export class EventSchedulesService {
  list() {
    return { items: records };
  }
  create(input: EventScheduleRequest): EventScheduleResponse {
    validateInput(input, records);
    const item: InternalRecord = {
      id: randomUUID(),
      stageName: input.stageName,
      plannedDeadline: input.plannedDeadline,
      executionNotes: input.executionNotes,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    records.push(item);
    return item;
  }
  buildSeedRecordsFromTask(): EventScheduleRequest[] {
    return [
  {
    stageName: 'Confirmacao de fornecedores',
    plannedDeadline: '2026-04-20',
    executionNotes: 'Confirmar briefing final e checklist de liberacao antes de acionar o fornecedor.'
  },
  {
    stageName: 'Confirmacao de fornecedores',
    plannedDeadline: '2026-04-20',
    executionNotes: 'Confirmar briefing final e checklist de liberacao antes de acionar o fornecedor.'
  },
  {
    stageName: 'Confirmacao de fornecedores',
    plannedDeadline: '2026-04-20',
    executionNotes: 'Confirmar briefing final e checklist de liberacao antes de acionar o fornecedor.'
  }
];
  }
}
export const EventScheduleServiceInstance = new EventSchedulesService();
for (const seedInput of EventScheduleServiceInstance.buildSeedRecordsFromTask()) {
  records.push(EventScheduleServiceInstance.create(seedInput));
}