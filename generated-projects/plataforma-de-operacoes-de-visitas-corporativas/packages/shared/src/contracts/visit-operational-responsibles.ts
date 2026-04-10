export interface VisitOperationalResponsibleRequest {
  responsibleName: string;
  contact: string;
  supportType: string;
}
export interface VisitOperationalResponsibleResponse {
  id: number | string;
  responsibleName: string;
  contact: string;
  supportType: string;
  status: 'draft' | 'active';
  createdAt: string;
}
export interface VisitOperationalResponsibleListResponse {
  items: VisitOperationalResponsibleResponse[];
}