import type { EventScheduleListResponse, EventScheduleRequest, EventScheduleResponse } from '../../../../../packages/shared/src/contracts/event-schedules';
export const eventScheduleQueryKey = ['EventSchedule'];
export async function fetchEventScheduleItems(): Promise<EventScheduleResponse[]> {
 const response = await fetch('/api/event-schedules');
 if (!response.ok) {
 throw new Error('Falha ao carregar registros da feature.');
 }
 const data: EventScheduleListResponse = await response.json();
 return data.items || [];
}
export async function createEventSchedule(input: EventScheduleRequest): Promise<EventScheduleResponse> {
 const response = await fetch('/api/event-schedules', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(input),
 });
 if (!response.ok) {
 const error = await response.json().catch(() => ({ message: 'Falha ao criar registro.' }));
 throw new Error(error.message || 'Falha ao criar registro.');
 }
 return response.json();
}