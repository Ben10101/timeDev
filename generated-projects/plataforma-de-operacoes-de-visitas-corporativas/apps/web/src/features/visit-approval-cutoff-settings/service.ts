import type { VisitApprovalCutoffSettingListResponse, VisitApprovalCutoffSettingRequest, VisitApprovalCutoffSettingResponse } from '../../../../../packages/shared/src/contracts/visit-approval-cutoff-settings.ts';
export const visitApprovalCutoffSettingQueryKey = ['VisitApprovalCutoffSetting'];
export async function fetchVisitApprovalCutoffSettingItems(): Promise<VisitApprovalCutoffSettingResponse[]> {
 const response = await fetch('/api/settings/visit-approval-cutoff');
 if (!response.ok) {
 throw new Error('Falha ao carregar registros da feature.');
 }
 const data: VisitApprovalCutoffSettingListResponse = await response.json();
 return data.items || [];
}
export async function createVisitApprovalCutoffSetting(input: VisitApprovalCutoffSettingRequest): Promise<VisitApprovalCutoffSettingResponse> {
 const response = await fetch('/api/settings/visit-approval-cutoff', {
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