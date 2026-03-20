export interface ProfileSettingsRequest {
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
  password: string;
}

export interface ProfileSettingsResponse {
  id: string;
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
  passwordHint?: string;
  status: 'draft' | 'active';
  createdAt: string;
}

export interface ProfileSettingsListResponse {
  items: ProfileSettingsResponse[];
}
