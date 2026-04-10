import type { VisitExtraCompanionRequest, VisitExtraCompanionResponse, VisitExtraCompanionListResponse } from './types';
export class VisitExtraCompanionService {
 private readonly baseUrl = '/api/visit-extra-companions';
 async createCompanion(data: VisitExtraCompanionRequest): Promise<VisitExtraCompanionResponse> {
 const response = await fetch(this.baseUrl, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(data),
 });
 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.message || 'Erro ao criar acompanhante');
 }
 return response.json();
 }
 async getCompanions(visitCode?: string): Promise<VisitExtraCompanionListResponse> {
 const url = visitCode ? `${this.baseUrl}?visitCode=${visitCode}` : this.baseUrl;
 const response = await fetch(url);
 if (!response.ok) {
 throw new Error('Erro ao buscar acompanhantes');
 }
 return response.json();
 }
 async updateCompanion(id: string, data: Partial<VisitExtraCompanionRequest>): Promise<VisitExtraCompanionResponse> {
 const response = await fetch(`${this.baseUrl}/${id}`, {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json',
 },
 body: JSON.stringify(data),
 });
 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.message || 'Erro ao atualizar acompanhante');
 }
 return response.json();
 }
 async deleteCompanion(id: string): Promise<void> {
 const response = await fetch(`${this.baseUrl}/${id}`, {
 method: 'DELETE',
 });
 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.message || 'Erro ao remover acompanhante');
 }
 }
}
export type {
 VisitExtraCompanionRequest,
 VisitExtraCompanionResponse,
 VisitExtraCompanionListResponse,
};