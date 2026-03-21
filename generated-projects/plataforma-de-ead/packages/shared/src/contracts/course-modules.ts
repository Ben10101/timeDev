export interface CourseModuleRequest {
  moduleName: string;
  moduleDescription?: string;
  displayOrder: string;
}

export interface CourseModuleResponse {
  id: string;
  moduleName: string;
  moduleDescription?: string;
  displayOrder: string;
  status: 'draft' | 'active';
  createdAt: string;
}

export interface CourseModuleListResponse {
  items: CourseModuleResponse[];
}
