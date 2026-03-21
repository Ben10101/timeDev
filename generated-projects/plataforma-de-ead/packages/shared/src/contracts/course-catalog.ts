export interface CourseCatalogRequest {
  courseName: string;
  description: string;
  category: string;
  price: string;
}

export interface CourseCatalogResponse {
  id: string;
  courseName: string;
  description: string;
  category: string;
  price: string;
  status: 'draft' | 'active';
  createdAt: string;
}

export interface CourseCatalogListResponse {
  items: CourseCatalogResponse[];
}
