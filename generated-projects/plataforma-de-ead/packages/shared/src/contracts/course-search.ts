export interface CourseSearchRequest {
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
}

export interface CourseSearchResponse {
  id: string;
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
  status: 'draft' | 'active';
  createdAt: string;
}

export interface CourseSearchListResponse {
  items: CourseSearchResponse[];
}
