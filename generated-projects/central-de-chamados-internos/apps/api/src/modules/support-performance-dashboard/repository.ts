import { randomUUID } from 'crypto';
import type { SupportPerformanceDashboardRequest, SupportPerformanceDashboardResponse } from '../../../../../packages/shared/src/contracts/support-performance-dashboard.ts';

const records: SupportPerformanceDashboardResponse[] = [];

export class SupportPerformanceDashboardRepository {
  list(): SupportPerformanceDashboardResponse[] {
    return records;
  }

  create(input: SupportPerformanceDashboardRequest): SupportPerformanceDashboardResponse {
    const item: SupportPerformanceDashboardResponse = {
      id: randomUUID(),
      categoryFilter: input.categoryFilter,
      statusFilter: input.statusFilter,
      timeRange: input.timeRange,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    records.unshift(item);
    return item;
  }

  seed(items: SupportPerformanceDashboardRequest[]): void {
    for (const item of items) {
      this.create(item);
    }
  }
}

export const supportPerformanceDashboardRepository = new SupportPerformanceDashboardRepository();
