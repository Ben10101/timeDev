import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { VisitExtraCompanionRequest, VisitExtraCompanionResponse } from '../../../../../packages/shared/src/contracts/visit-extra-companions';
import { OperationsWorkspace, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { visitExtraCompanionFormSchema, type VisitExtraCompanionFormValues } from './schema';
import { visitExtraCompanionQueryKey, createVisitExtraCompanion, fetchVisitExtraCompanionItems } from './service';
const initialForm: VisitExtraCompanionFormValues = {
 approvedVisitCode: '',
 companionName: '',
 securityFastApproval: 'pendente',
};
function humanizeStatus(value?: string) {
 const normalized = String(value || '').trim().toLowerCase();
 const directMap: Record<string, string> = {
 active: 'Ativo',
 enabled: 'Ativado',
 disabled: 'Desativado',
 draft: 'Em preparacao',
 pending: 'Pendente',
 };
 return directMap[normalized] || (value ? String(value) : 'Ativo');
}
function formatCreatedAt(value?: string) {
 if (!value) return 'Agora';
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return 'Agora';
 return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
export function VisitExtraCompanionsPage() {
 const queryClient = useQueryClient();
 const { data: items = [], isLoading } = useQuery<VisitExtraCompanionResponse[]>({
 queryKey: visitExtraCompanionQueryKey,
 queryFn: fetchVisitExtraCompanionItems,
 });
 const {
 register,
 handleSubmit,
 reset,
 formState: { errors, isSubmitting },
 } = useForm<VisitExtraCompanionFormValues>({
 resolver: zodResolver(visitExtraCompanionFormSchema),
 defaultValues: initialForm,
 });
 const mutation = useMutation({
 mutationFn: (input: VisitExtraCompanionRequest) => createVisitExtraCompanion(input),
 onSuccess: (created) => {
 queryClient.setQueryData<VisitExtraCompanionResponse[]>(visitExtraCompanionQueryKey, (current = []) => [created, ...current]);
 reset(initialForm);
 },
 });
 return (
 <OperationsWorkspace
 accent="teal"
 productMode="approval-flow"
 uiIntent="attach"
 layoutVariant="balanced-split"
 pageArchetype="approval-flow"
 fallbackPattern="github-review"
 patternHints={["approval-flow","github-review","decision-focused","workflow-guided"]}
 sections={["hero","steps","summary","activity"]}
 componentMap={{"recordsLead":"approvalSteps","summary":"settingsSnapshot","activity":"activityTimeline"}}
 eyebrow="Visitas"
 title="Inclua acompanhantes extras na visita"
 description="Adicione consultores e acompanhantes em visitas ja aprovadas sem reiniciar todo o fluxo de liberacao."
 highlights={["A inclusao precisa apontar para uma visita ja aprovada, sem reabrir o processo inteiro.","A decisao rapida da seguranca deve ficar visivel para evitar duvida operacional na recepcao.","A lista deve parecer extensao da visita, nao um cadastro isolado sem contexto."]}
 formTitle="Novo acompanhante extra"
 formDescription="Vincule o acompanhante a uma visita aprovada e registre a decisao rapida da seguranca."
 form={
 <form onSubmit={handleSubmit((values) => mutation.mutateAsync({
 approvedVisitCode: values.approvedVisitCode,
 companionName: values.companionName,
 securityFastApproval: values.securityFastApproval,
 }))} style={{ display: 'grid', gap: 18 }}>
 <FieldGroup label="Visita aprovada" hint="Informe o identificador da visita ja aprovada para vincular o acompanhante extra ao registro correto.">
 <input
 {...register('approvedVisitCode')}
 type="text"
 placeholder="Ex.: VIS-2026-0142"
 style={inputStyle()}
 />
 {errors.approvedVisitCode ? <small style={{ color: '#b91c1c' }}>{errors.approvedVisitCode.message}</small> : null}
 </FieldGroup>
 <FieldGroup label="Nome do acompanhante" hint="Registre o nome de quem sera incluido na mesma visita aprovada.">
 <input
 {...register('companionName')}
 type="text"
 placeholder="Ex.: Ana Beatriz Lopes"
 style={inputStyle()}
 />
 {errors.companionName ? <small style={{ color: '#b91c1c' }}>{errors.companionName.message}</small> : null}
 </FieldGroup>
 <FieldGroup label="Aprovacao rapida da seguranca" hint="Indique a decisao rapida da seguranca para liberar a inclusao sem reiniciar o fluxo completo.">
 <select
 {...register('securityFastApproval')}
 style={inputStyle()}
 >
 <option value="pendente">Pendente</option>
 <option value="aprovado">Aprovado</option>
 </select>
 {errors.securityFastApproval ? <small style={{ color: '#b91c1c' }}>{errors.securityFastApproval.message}</small> : null}
 </FieldGroup>
 <PrimaryButton type="submit" accent="teal">
 {isSubmitting || mutation.isPending ? 'Processando...' : 'Adicionar Acompanhante'}
 </PrimaryButton>
 {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>"Acompanhante extra registrado com sucesso."</p> : null}
 {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
 </form>
 }
 listTitle="Acompanhantes vinculados"
 listDescription="Nenhum acompanhante extra registrado ainda para visitas aprovadas."
 listMeta={isLoading ? 'Atualizando' : items.length ? `${items.length} registro(s)` : 'Nenhum registro'}
 >
 <div style={{ display: 'grid', gap: 10 }}>
 {isLoading ? (
 <div style={{ display: 'grid', gap: 10 }}>
 {[0, 1, 2].map((placeholder) => (
 <div key={placeholder} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, alignItems: 'center' }}>
 <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#dbeafe' }} />
 <div style={{ minHeight: 44, borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }} />
 </div>
 ))}
 </div>
 ) : items.length ? (
 items.map((item) => (
 <article
 key={item.id}
 style={{
 padding: '14px 16px',
 borderRadius: 14,
 background: '#ffffff',
 border: '1px solid #d9deea',
 display: 'grid',
 gridTemplateColumns: '1.15fr 0.9fr 0.85fr',
 gap: 12,
 alignItems: 'center',
 }}
 >
 <div style={{ display: 'grid', gap: 4 }}>
 <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{String(item.approvedVisitCode || item.id)}</strong>
 <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.companionName || 'Etapa pronta para decisao')}</span>
 </div>
 <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#e0e7ff', color: '#4338ca', fontSize: 12, fontWeight: 700 }}>
 {humanizeStatus(String(item.status || 'pending'))}
 </span>
 <span style={{ color: '#64748b', fontSize: 13 }}>{formatCreatedAt(String(item.createdAt || ''))}</span>
 </article>
 ))
 ) : (
 <div style={{ padding: 28, borderRadius: 16, background: '#eef2ff', border: '1px dashed #a5b4fc', textAlign: 'center' }}>
 <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'grid', placeItems: 'center', fontSize: 24 }}>1</div>
 <p style={{ margin: 0, color: '#4c1d95', lineHeight: 1.7 }}>"Nenhum acompanhante extra registrado ainda para visitas aprovadas."</p>
 </div>
 )}
 </div>
 </OperationsWorkspace>
 );
}