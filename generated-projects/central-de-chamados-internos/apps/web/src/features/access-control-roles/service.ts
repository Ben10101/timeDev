import type { AccessControlRoleListResponse, AccessControlRoleRequest, AccessControlRoleResponse } from '../../../../../packages/shared/src/contracts/access-control-roles.ts';

export const accessControlRolesQueryKey = ['access-control-roles'];

export async function fetchAccessControlRoleItems(): Promise<AccessControlRoleResponse[]> {
 const response = await fetch('/api/access-control/roles');
 if (!response.ok) {
 throw new Error('Falha ao carregar perfis de acesso.');
 }
 const data: AccessControlRoleListResponse = await response.json();
 return data.items || [];
}
export async function createAccessControlRole(input: AccessControlRoleRequest): Promise<AccessControlRoleResponse> {
 const response = await fetch('/api/access-control/roles', {
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
