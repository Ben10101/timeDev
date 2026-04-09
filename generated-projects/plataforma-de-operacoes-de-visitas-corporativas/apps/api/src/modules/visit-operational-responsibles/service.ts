import { randomUUID } from 'crypto';
import type { VisitOperationalResponsibleRequest, VisitOperationalResponsibleResponse } from '../../../../../packages/shared/src/contracts/visit-operational-responsibles.ts';
type InternalRecord = VisitOperationalResponsibleResponse & {
  updatedAt?: string;
};
const records: InternalRecord[] = [];
export class VisitOperationalResponsiblesService {
  list() {
    return { items: records };
  }
  create(input: VisitOperationalResponsibleRequest): VisitOperationalResponsibleResponse {
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
  buildSeedRecordsFromTask(): VisitOperationalResponsibleRequest[] {
    return [];
  }
}
export const VisitOperationalResponsibleServiceInstance = new VisitOperationalResponsiblesService();