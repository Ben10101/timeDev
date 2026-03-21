export interface LessonMaterialRequest {
  materialTitle: string;
  fileType: string;
  fileUrl: string;
}

export interface LessonMaterialResponse {
  id: string;
  materialTitle: string;
  fileType: string;
  fileUrl: string;
  status: 'draft' | 'active';
  createdAt: string;
}

export interface LessonMaterialListResponse {
  items: LessonMaterialResponse[];
}
