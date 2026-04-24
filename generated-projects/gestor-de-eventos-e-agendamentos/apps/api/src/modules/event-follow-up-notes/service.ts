import { PrismaClient } from '@prisma/client';
import type { EventFollowUpNoteRequest, EventFollowUpNoteResponse } from '../../../../../packages/shared/src/contracts/event-follow-up-notes';
const prisma = new PrismaClient();
export class EventFollowUpNotesService {
  async list(): Promise<{ items: EventFollowUpNoteResponse[] }> {
    const items = await prisma.eventFollowUpNote.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { items: items as unknown as EventFollowUpNoteResponse[] };
  }
  async create(input: EventFollowUpNoteRequest): Promise<EventFollowUpNoteResponse> {
    const item = await prisma.eventFollowUpNote.create({
      data: {
        ...input,
        status: 'active'
      }
    });
    return item as unknown as EventFollowUpNoteResponse;
  }
}
export const EventFollowUpNoteServiceInstance = new EventFollowUpNotesService();