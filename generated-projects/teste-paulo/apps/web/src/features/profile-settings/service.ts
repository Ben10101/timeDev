import type { ProfileSettingsListResponse, ProfileSettingsRequest, ProfileSettingsResponse } from '../../../../../packages/shared/src/contracts/profile-settings.ts';

export async function fetchProfileSettingsItems(): Promise<ProfileSettingsResponse[]> {
  const response = await fetch('/api/profile');
  const data: ProfileSettingsListResponse = await response.json();
  return data.items || [];
}

export async function createProfileSettings(input: ProfileSettingsRequest): Promise<ProfileSettingsResponse> {
  const response = await fetch('/api/profile', {
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
