import type { VisitOperationalResponsibleListResponse, VisitOperationalResponsibleRequest, VisitOperationalResponsibleResponse } from '../../../../../packages/shared/src/contracts/visit-operational-responsibles.ts';
export const visitOperationalResponsibleQueryKey = ['VisitOperationalResponsible'];
export async function fetchVisitOperationalResponsibleItems(): Promise<VisitOperationalResponsibleResponse[]> {
 const response = await fetch('/api/visit-operational-responsibles');
 if (!response.ok) {
 throw new Error('Falha ao carregar registros da feature.');
 }
 const data: VisitOperationalResponsibleListResponse = await response.json();
 return data.items || [];
}
export async function createVisitOperationalResponsible(input: VisitOperationalResponsibleRequest): Promise<VisitOperationalResponsibleResponse> {
 const response = await fetch('/api/visit-operational-responsibles', {
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