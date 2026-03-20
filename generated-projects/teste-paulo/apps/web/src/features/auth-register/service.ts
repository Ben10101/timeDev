import type { AccountRegistrationListResponse, AccountRegistrationRequest, AccountRegistrationResponse } from '../../../../../packages/shared/src/contracts/auth-register.ts';

export async function fetchAccountRegistrationItems(): Promise<AccountRegistrationResponse[]> {
  const response = await fetch('/api/auth/register');
  const data: AccountRegistrationListResponse = await response.json();
  return data.items || [];
}

export async function createAccountRegistration(input: AccountRegistrationRequest): Promise<AccountRegistrationResponse> {
  const response = await fetch('/api/auth/register', {
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
