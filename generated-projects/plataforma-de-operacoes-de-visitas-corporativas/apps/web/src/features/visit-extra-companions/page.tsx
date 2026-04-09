import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { VisitExtraCompanionRequest, VisitExtraCompanionResponse } from '../../../../../packages/shared/src/contracts/visit-extra-companions.ts';
import { FieldGroup, PrimaryButton, SurfaceCard, inputStyle, tokens } from '../../../../../packages/ui/src/index.tsx';
import { visitExtraCompanionFormSchema, type VisitExtraCompanionFormValues } from './schema';
import { visitExtraCompanionQueryKey, createVisitExtraCompanion, fetchVisitExtraCompanionItems } from './service';
const initialForm: VisitExtraCompanionFormValues = {
 approvedVisitCode: '',
 companionName: '',
 securityFastApproval: 'pendente',
};
function formatCreatedAt(value?: string) {
 if (!value) return 'Agora';
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return 'Agora';
 return parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
 <section style={{ display: 'grid', gap: 16 }}>
 <header style={{ display: 'grid', gap: 6 }}>
 <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
 Acompanhantes extras
 </span>
 <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#0f172a' }}>Adicione acompanhantes extras</h1>
 <p style={{ margin: 0, color: tokens.color.mutedStrong, maxWidth: 760, lineHeight: 1.65 }}>Inclua acompanhantes adicionais em visitas aprovadas sem reiniciar todo o fluxo de aprovacao.</p>
 </header>
 <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
 <SurfaceCard title='Cadastro' description='Preencha os campos principais e confirme o registro.'>
 <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values as VisitExtraCompanionRequest))} style={{ display: 'grid', gap: 14 }}>
 <FieldGroup label='Visita aprovada' hint='Informe o identificador da visita ja aprovada para vincular o acompanhante extra ao registro correto.'>
 <input {...register('approvedVisitCode')} type='text' placeholder='Ex.: VIS-2026-0142' style={inputStyle({ borderRadius: 10, padding: '12px 13px' })} />
 {errors.approvedVisitCode ? <small style={{ color: '#b91c1c' }}>{errors.approvedVisitCode.message}</small> : null}
 </FieldGroup>
 <FieldGroup label='Nome do acompanhante' hint='Registre o nome de quem sera incluido na mesma visita aprovada.'>
 <input {...register('companionName')} type='text' placeholder='Ex.: Ana Beatriz Lopes' style={inputStyle({ borderRadius: 10, padding: '12px 13px' })} />
 {errors.companionName ? <small style={{ color: '#b91c1c' }}>{errors.companionName.message}</small> : null}
 </FieldGroup>
 <FieldGroup label='Aprovacao rapida da seguranca' hint='Indique a decisao rapida da seguranca para liberar a inclusao sem reiniciar o fluxo completo.'>
 <select {...register('securityFastApproval')} style={inputStyle({ borderRadius: 10, padding: '12px 13px' })}>
 <option value='pendente'>Pendente</option>
 <option value='aprovado'>Aprovado</option>
 </select>
 {errors.securityFastApproval ? <small style={{ color: '#b91c1c' }}>{errors.securityFastApproval.message}</small> : null}
 </FieldGroup>
 <PrimaryButton type='submit'>
 {isSubmitting || mutation.isPending ? 'Processando...' : 'Adicionar Acompanhante'}
 </PrimaryButton>
 {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>Acompanhante extra registrado com sucesso.</p> : null}
 {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
 </form>
 </SurfaceCard>
 <SurfaceCard title='Acompanhantes vinculados' description='Lista operacional com leitura direta dos campos principais.' meta={isLoading ? 'Carregando...' : `${items.length} itens`}>
 {isLoading ? (
 <div style={{ padding: 8, color: '#64748b' }}>Carregando dados...</div>
 ) : items.length ? (
 <div style={{ display: 'grid' }}>
 {items.map((item) => (
 <div key={String(item.id || Math.random())} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, padding: '12px 0', borderBottom: '1px solid #eef2f7', alignItems: 'center' }}>
 <div style={{ display: 'grid', gap: 4 }}>
 <strong style={{ color: '#0f172a', fontSize: 14 }}>{String(item.approvedVisitCode || item.id || 'registro')}</strong>
 <span style={{ color: '#64748b', fontSize: 12 }}>Nome do acompanhante: {String(item.companionName || '-')}</span>
 </div>
 <span style={{ color: '#64748b', fontSize: 12 }}>{formatCreatedAt(item.createdAt)}</span>
 </div>
 ))}
 </div>
 ) : (
 <div style={{ padding: 8, color: '#64748b', lineHeight: 1.6 }}>Nenhum acompanhante extra registrado ainda para visitas aprovadas.</div>
 )}
 </SurfaceCard>
 </div>
 </section>
 );
}