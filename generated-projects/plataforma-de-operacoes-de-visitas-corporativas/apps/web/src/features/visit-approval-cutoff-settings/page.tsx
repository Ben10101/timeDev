import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { VisitApprovalCutoffSettingRequest, VisitApprovalCutoffSettingResponse } from '../../../../../packages/shared/src/contracts/visit-approval-cutoff-settings.ts';
import { FieldGroup, PrimaryButton, SurfaceCard, inputStyle, tokens } from '../../../../../packages/ui/src/index.tsx';
import { visitApprovalCutoffSettingFormSchema, type VisitApprovalCutoffSettingFormValues } from './schema';
import { visitApprovalCutoffSettingQueryKey, createVisitApprovalCutoffSetting, fetchVisitApprovalCutoffSettingItems } from './service';
const initialForm: VisitApprovalCutoffSettingFormValues = {
 cutoffTime: '',
};
export function VisitApprovalCutoffSettingsPage() {
 const queryClient = useQueryClient();
 const { data: items = [], isLoading } = useQuery<VisitApprovalCutoffSettingResponse[]>({
 queryKey: visitApprovalCutoffSettingQueryKey,
 queryFn: fetchVisitApprovalCutoffSettingItems,
 });
 const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<VisitApprovalCutoffSettingFormValues>({
 resolver: zodResolver(visitApprovalCutoffSettingFormSchema),
 defaultValues: initialForm,
 });
 const mutation = useMutation({
 mutationFn: (input: VisitApprovalCutoffSettingRequest) => createVisitApprovalCutoffSetting(input),
 onSuccess: (created) => {
 queryClient.setQueryData<VisitApprovalCutoffSettingResponse[]>(visitApprovalCutoffSettingQueryKey, (current = []) => [created, ...current]);
 reset(initialForm);
 },
 });
 return (
 <section style={{ display: 'grid', gap: 16, maxWidth: 960 }}>
 <header style={{ display: 'grid', gap: 6 }}>
 <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
 Horarios limite
 </span>
 <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#0f172a' }}>Configure o horario limite de aprovacao</h1>
 <p style={{ margin: 0, color: tokens.color.mutedStrong, maxWidth: 760, lineHeight: 1.65 }}>Defina o horario diario usado para bloquear visitas de ultima hora sem tempo de analise operacional.</p>
 </header>
 <SurfaceCard title='Ajuste principal' description='Atualize a configuracao e confira o estado atual logo abaixo.'>
 <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values as VisitApprovalCutoffSettingRequest))} style={{ display: 'grid', gap: 14 }}>
 <FieldGroup label='Horario limite' hint='Use o formato HH:MM para definir o horario limite diario.'>
 <input {...register('cutoffTime')} type='text' placeholder='17:00' style={inputStyle({ borderRadius: 10, padding: '12px 13px' })} />
 {errors.cutoffTime ? <small style={{ color: '#b91c1c' }}>{errors.cutoffTime.message}</small> : null}
 </FieldGroup>
 <PrimaryButton type='submit'>
 {isSubmitting || mutation.isPending ? 'Processando...' : 'Salvar ajustes'}
 </PrimaryButton>
 {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>Horario limite atualizado com sucesso.</p> : null}
 {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
 </form>
 </SurfaceCard>
 <SurfaceCard title='Resumo atual' description='Ultimo estado aplicado para esta configuracao.' meta={isLoading ? 'Carregando...' : `${items.length} itens`}>
 {isLoading ? (
 <div style={{ padding: 8, color: '#64748b' }}>Carregando dados...</div>
 ) : items.length ? (
 <div style={{ display: 'grid', gap: 10 }}>
 {items.map((item) => (
 <div key={String(item.id || Math.random())} style={{ display: 'grid', gap: 4, padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
 <strong style={{ color: '#0f172a', fontSize: 14 }}>{String(item.cutoffTime || item.id || 'registro')}</strong>
 </div>
 ))}
 </div>
 ) : (
 <div style={{ padding: 8, color: '#64748b', lineHeight: 1.6 }}>Nenhum horario limite Ativo ainda.</div>
 )}
 </SurfaceCard>
 </section>
 );
}