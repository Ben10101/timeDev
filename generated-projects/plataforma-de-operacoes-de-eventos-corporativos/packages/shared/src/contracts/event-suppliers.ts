export interface EventSupplierRequest {
  supplierName: string;
  serviceCategory: string;
  primaryContacts: string;
}
export interface EventSupplierResponse {
  id: string;
  supplierName: string;
  serviceCategory: string;
  primaryContacts: string;
  status: 'draft' | 'active';
  createdAt: string;
}
export interface EventSupplierListResponse {
  items: EventSupplierResponse[];
}