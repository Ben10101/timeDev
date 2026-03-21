export interface CourseLessonRequest {
  lessonTitle: string;
  mediaType: string;
  moduleReference: string;
}

export interface CourseLessonResponse {
  id: string;
  lessonTitle: string;
  mediaType: string;
  moduleReference: string;
  status: 'draft' | 'active';
  createdAt: string;
}

export interface CourseLessonListResponse {
  items: CourseLessonResponse[];
}
