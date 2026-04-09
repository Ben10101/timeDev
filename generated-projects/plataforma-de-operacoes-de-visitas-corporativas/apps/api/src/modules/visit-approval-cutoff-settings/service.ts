import { randomUUID } from 'crypto';
import type { VisitApprovalCutoffSettingRequest, VisitApprovalCutoffSettingResponse } from '../../../../../packages/shared/src/contracts/visit-approval-cutoff-settings.ts';
type InternalRecord = VisitApprovalCutoffSettingResponse & {
  updatedAt?: string;
};
const records: InternalRecord[] = [];
export class VisitApprovalCutoffSettingsService {
  list() {
    return { items: records };
  }
  create(input: VisitApprovalCutoffSettingRequest): VisitApprovalCutoffSettingResponse {
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
  buildSeedRecordsFromTask(): VisitApprovalCutoffSettingRequest[] {
    return [];
  }
}
export const VisitApprovalCutoffSettingServiceInstance = new VisitApprovalCutoffSettingsService();