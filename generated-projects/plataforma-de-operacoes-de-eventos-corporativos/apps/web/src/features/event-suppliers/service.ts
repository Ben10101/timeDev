import type { EventSupplierListResponse, EventSupplierRequest, EventSupplierResponse } from '../../../../../packages/shared/src/contracts/event-suppliers.ts';
export const eventSupplierQueryKey = ['event-suppliers'];
export async function fetchEventSupplierItems(): Promise<EventSupplierResponse[]> {
 const response = await fetch('/api/event-suppliers');
 if (!response.ok) {
 throw new Error('Falha ao carregar registros da feature.');
 }
 const data: EventSupplierListResponse = await response.json();
 return data.items || [];
}
export async function createEventSupplier(input: EventSupplierRequest): Promise<EventSupplierResponse> {
 const response = await fetch('/api/event-suppliers', {
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