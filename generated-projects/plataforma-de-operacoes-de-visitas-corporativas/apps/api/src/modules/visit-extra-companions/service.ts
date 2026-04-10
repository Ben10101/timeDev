import { PrismaClient } from '@prisma/client';
import type { VisitExtraCompanionRequest, VisitExtraCompanionResponse } from '../../../../../packages/shared/src/contracts/visit-extra-companions';
const prisma = new PrismaClient();
export class VisitExtraCompanionsService {
  async list(): Promise<{ items: VisitExtraCompanionResponse[] }> {
    const items = await prisma.visitExtraCompanion.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { items: items as unknown as VisitExtraCompanionResponse[] };
  }
  async create(input: VisitExtraCompanionRequest): Promise<VisitExtraCompanionResponse> {
    const item = await prisma.visitExtraCompanion.create({
      data: {
        ...input,
        status: 'active'
      }
    });
    return item as unknown as VisitExtraCompanionResponse;
  }
}
export const VisitExtraCompanionServiceInstance = new VisitExtraCompanionsService();