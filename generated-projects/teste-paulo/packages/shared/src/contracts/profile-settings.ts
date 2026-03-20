export interface ProfileSettingsRequest {
  fullName: string;
  profilePhotoUrl?: string;
}

export interface ProfileSettingsResponse {
  id: string;
  fullName: string;
  profilePhotoUrl?: string;
  status: 'draft' | 'active';
  createdAt: string;
}

export interface ProfileSettingsListResponse {
  items: ProfileSettingsResponse[];
}
