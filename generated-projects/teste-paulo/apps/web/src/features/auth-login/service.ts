import type { LoginSessionListResponse, LoginSessionRequest, LoginSessionResponse } from '../../../../../packages/shared/src/contracts/auth-login.ts';

export async function fetchLoginSessionItems(): Promise<LoginSessionResponse[]> {
  const response = await fetch('/api/auth/login');
  const data: LoginSessionListResponse = await response.json();
  return data.items || [];
}

export async function createLoginSession(input: LoginSessionRequest): Promise<LoginSessionResponse> {
  const response = await fetch('/api/auth/login', {
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
