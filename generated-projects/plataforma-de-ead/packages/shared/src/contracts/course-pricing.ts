export interface CoursePricingRequest {
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
}

export interface CoursePricingResponse {
  id: string;
  fullName: string;
  profilePhotoUrl?: string;
  email: string;
  status: 'draft' | 'active';
  createdAt: string;
}

export interface CoursePricingListResponse {
  items: CoursePricingResponse[];
}
