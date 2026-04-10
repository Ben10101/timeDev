export interface VisitExtraCompanionRequest {
  approvedVisitCode: string;
  companionName: string;
  securityFastApproval: string;
}
export interface VisitExtraCompanionResponse {
  id: string;
  approvedVisitCode: string;
  companionName: string;
  securityFastApproval: string;
  status: 'draft' | 'active';
  createdAt: string;
}
export interface VisitExtraCompanionListResponse {
  items: VisitExtraCompanionResponse[];
}