import type { VisitRecurringHistoryListResponse, VisitRecurringHistoryRequest, VisitRecurringHistoryResponse } from '../../../../../packages/shared/src/contracts/visit-recurring-history.ts';
export const visitRecurringHistoryQueryKey = ['VisitRecurringHistory'];
export async function fetchVisitRecurringHistoryItems(): Promise<VisitRecurringHistoryResponse[]> {
 const response = await fetch('/api/visit-recurring-history');
 if (!response.ok) {
 throw new Error('Falha ao carregar registros da feature.');
 }
 const data: VisitRecurringHistoryListResponse = await response.json();
 return data.items || [];
}
export async function createVisitRecurringHistory(input: VisitRecurringHistoryRequest): Promise<VisitRecurringHistoryResponse> {
 const response = await fetch('/api/visit-recurring-history', {
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