export interface ProfileSettingsRequest {
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
}
export interface ProfileSettingsResponse {
  id: string;
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
  status: 'draft' | 'active';
  createdAt: string;
}
export interface ProfileSettingsListResponse {
  items: ProfileSettingsResponse[];
}