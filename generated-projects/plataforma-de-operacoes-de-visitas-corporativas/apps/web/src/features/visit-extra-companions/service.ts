import type { VisitExtraCompanionListResponse, VisitExtraCompanionRequest, VisitExtraCompanionResponse } from '../../../../../packages/shared/src/contracts/visit-extra-companions.ts';
export const visitExtraCompanionQueryKey = ['VisitExtraCompanion'];
export async function fetchVisitExtraCompanionItems(): Promise<VisitExtraCompanionResponse[]> {
 const response = await fetch('/api/visit-extra-companions');
 if (!response.ok) {
 throw new Error('Falha ao carregar registros da feature.');
 }
 const data: VisitExtraCompanionListResponse = await response.json();
 return data.items || [];
}
export async function createVisitExtraCompanion(input: VisitExtraCompanionRequest): Promise<VisitExtraCompanionResponse> {
 const response = await fetch('/api/visit-extra-companions', {
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