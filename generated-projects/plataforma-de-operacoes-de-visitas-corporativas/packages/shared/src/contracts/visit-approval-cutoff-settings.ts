export interface VisitApprovalCutoffSettingRequest {
  cutoffTime: string;
}
export interface VisitApprovalCutoffSettingResponse {
  id: string;
  cutoffTime: string;
  status: 'draft' | 'active';
  createdAt: string;
}
export interface VisitApprovalCutoffSettingListResponse {
  items: VisitApprovalCutoffSettingResponse[];
}