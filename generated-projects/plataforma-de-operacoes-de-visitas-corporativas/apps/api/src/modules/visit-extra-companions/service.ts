import { randomUUID } from 'crypto';
import type { VisitExtraCompanionRequest, VisitExtraCompanionResponse } from '../../../../../packages/shared/src/contracts/visit-extra-companions.ts';
type InternalRecord = VisitExtraCompanionResponse & {
  updatedAt?: string;
};
const records: InternalRecord[] = [];
export class VisitExtraCompanionsService {
  list() {
    return { items: records };
  }
  create(input: VisitExtraCompanionRequest): VisitExtraCompanionResponse {
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
  buildSeedRecordsFromTask(): VisitExtraCompanionRequest[] {
    return [];
  }
}
export const VisitExtraCompanionServiceInstance = new VisitExtraCompanionsService();