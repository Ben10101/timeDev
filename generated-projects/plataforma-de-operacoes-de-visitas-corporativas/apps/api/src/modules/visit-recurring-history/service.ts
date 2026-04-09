import { randomUUID } from 'crypto';
import type { VisitRecurringHistoryRequest, VisitRecurringHistoryResponse } from '../../../../../packages/shared/src/contracts/visit-recurring-history.ts';
type InternalRecord = VisitRecurringHistoryResponse & {
  updatedAt?: string;
};
const records: InternalRecord[] = [];
export class VisitRecurringHistoryService {
  list() {
    return { items: records };
  }
  create(input: VisitRecurringHistoryRequest): VisitRecurringHistoryResponse {
    const item: InternalRecord = {
      ...input,
      id: randomUUID(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    records.push(item);
    return item;
  }
  buildSeedRecordsFromTask(): VisitRecurringHistoryRequest[] {
    return [];
  }
}
export const VisitRecurringHistoryServiceInstance = new VisitRecurringHistoryService();