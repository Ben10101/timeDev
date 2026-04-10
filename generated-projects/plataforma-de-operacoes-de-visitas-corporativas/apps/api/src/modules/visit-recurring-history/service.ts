import { PrismaClient } from '@prisma/client';
import type { VisitRecurringHistoryRequest, VisitRecurringHistoryResponse } from '../../../../../packages/shared/src/contracts/visit-recurring-history';
const prisma = new PrismaClient();
export class VisitRecurringHistoryService {
  async list(): Promise<{ items: VisitRecurringHistoryResponse[] }> {
    const items = await prisma.visitRecurringHistory.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { items: items as unknown as VisitRecurringHistoryResponse[] };
  }
  async create(input: VisitRecurringHistoryRequest): Promise<VisitRecurringHistoryResponse> {
    const item = await prisma.visitRecurringHistory.create({
      data: {
        ...input,
        status: 'active'
      }
    });
    return item as unknown as VisitRecurringHistoryResponse;
  }
}
export const VisitRecurringHistoryServiceInstance = new VisitRecurringHistoryService();