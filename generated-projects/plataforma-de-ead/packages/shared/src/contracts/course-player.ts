export interface CoursePlayerRequest {
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
}

export interface CoursePlayerResponse {
  id: string;
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
  status: 'draft' | 'active';
  createdAt: string;
}

export interface CoursePlayerListResponse {
  items: CoursePlayerResponse[];
}
