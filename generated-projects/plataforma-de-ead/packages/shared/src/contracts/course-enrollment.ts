export interface CourseEnrollmentRequest {
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
  password: string;
}

export interface CourseEnrollmentResponse {
  id: string;
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
  passwordHint?: string;
  status: 'draft' | 'active';
  createdAt: string;
}

export interface CourseEnrollmentListResponse {
  items: CourseEnrollmentResponse[];
}
