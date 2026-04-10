import { PrismaClient } from '@prisma/client';
import type { EventScheduleRequest, EventScheduleResponse } from '../../../../../packages/shared/src/contracts/event-schedules';
const prisma = new PrismaClient();
export class EventSchedulesService {
  async list(): Promise<{ items: EventScheduleResponse[] }> {
    const items = await prisma.eventSchedule.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { items: items as unknown as EventScheduleResponse[] };
  }
  async create(input: EventScheduleRequest): Promise<EventScheduleResponse> {
    const item = await prisma.eventSchedule.create({
      data: {
        ...input,
        status: 'active'
      }
    });
    return item as unknown as EventScheduleResponse;
  }
}
export const EventScheduleServiceInstance = new EventSchedulesService();