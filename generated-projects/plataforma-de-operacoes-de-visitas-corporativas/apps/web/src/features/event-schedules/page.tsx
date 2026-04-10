import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { EventScheduleRequest, EventScheduleResponse } from '../../../../../packages/shared/src/contracts/event-schedules';
import { FieldGroup, PrimaryButton, SurfaceCard, inputStyle, tokens } from '../../../../../packages/ui/src/index.tsx';
import { eventScheduleFormSchema, type EventScheduleFormValues } from './schema';
import { eventScheduleQueryKey, createEventSchedule, fetchEventScheduleItems } from './service';
const initialForm: EventScheduleFormValues = {
 stageName: '',
 plannedDeadline: '',
 executionNotes: '',
};
function formatCreatedAt(value?: string) {
 if (!value) return 'Agora';
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return 'Agora';
 return parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
export function EventSchedulesPage() {
 const queryClient = useQueryClient();
 const { data: items = [], isLoading } = useQuery<EventScheduleResponse[]>({
 queryKey: eventScheduleQueryKey,
 queryFn: fetchEventScheduleItems,
 });
 const {
 register,
 handleSubmit,
 reset,
 formState: { errors, isSubmitting },
 } = useForm<EventScheduleFormValues>({
 resolver: zodResolver(eventScheduleFormSchema),
 defaultValues: initialForm,
 });
 const mutation = useMutation({
 mutationFn: (input: EventScheduleRequest) => createEventSchedule(input),
 onSuccess: (created) => {
 queryClient.setQueryData<EventScheduleResponse[]>(eventScheduleQueryKey, (current = []) => [created, ...current]);
 reset(initialForm);
 },
 });
 return (
 <section style={{ display: 'grid', gap: 16 }}>
 <header style={{ display: 'grid', gap: 6 }}>
 <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
 Cronograma
 </span>
 <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#0f172a' }}>Monte o cronograma inicial do evento</h1>
 <p style={{ margin: 0, color: tokens.color.mutedStrong, maxWidth: 760, lineHeight: 1.65 }}>Organize etapas, prazos e responsaveis para manter a execucao do evento previsivel desde o planejamento.</p>
 </header>
 <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
 <SurfaceCard title='Cadastro' description='Preencha os campos principais e confirme o registro.'>
 <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values as EventScheduleRequest))} style={{ display: 'grid', gap: 14 }}>
 <FieldGroup label='Etapa do cronograma' hint='Nomeie a etapa principal para deixar o plano facil de acompanhar.'>
 <input {...register('stageName')} type='text' placeholder='Ex.: Confirmacao de fornecedores' style={inputStyle({ borderRadius: 10, padding: '12px 13px' })} />
 {errors.stageName ? <small style={{ color: '#b91c1c' }}>{errors.stageName.message}</small> : null}
 </FieldGroup>
 <FieldGroup label='Prazo planejado' hint='Defina a data alvo dessa etapa para dar previsibilidade ao time.'>
 <input {...register('plannedDeadline')} type='text' placeholder='2026-04-20' style={inputStyle({ borderRadius: 10, padding: '12px 13px' })} />
 {errors.plannedDeadline ? <small style={{ color: '#b91c1c' }}>{errors.plannedDeadline.message}</small> : null}
 </FieldGroup>
 <FieldGroup label='Notas operacionais' hint='Registre o contexto minimo da etapa para facilitar a execucao e o handoff.'>
 <input {...register('executionNotes')} type='text' placeholder='Dependencias, criterio de prontidao e observacoes importantes.' style={inputStyle({ borderRadius: 10, padding: '12px 13px' })} />
 {errors.executionNotes ? <small style={{ color: '#b91c1c' }}>{errors.executionNotes.message}</small> : null}
 </FieldGroup>
 <PrimaryButton type='submit'>
 {isSubmitting || mutation.isPending ? 'Processando...' : 'Adicionar Etapa'}
 </PrimaryButton>
 {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>Etapa do cronograma registrada com sucesso.</p> : null}
 {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
 </form>
 </SurfaceCard>
 <SurfaceCard title='Etapas do cronograma' description='Lista operacional com leitura direta dos campos principais.' meta={isLoading ? 'Carregando...' : `${items.length} itens`}>
 {isLoading ? (
 <div style={{ padding: 8, color: '#64748b' }}>Carregando dados...</div>
 ) : items.length ? (
 <div style={{ display: 'grid' }}>
 {items.map((item) => (
 <div key={String(item.id || Math.random())} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, padding: '12px 0', borderBottom: '1px solid #eef2f7', alignItems: 'center' }}>
 <div style={{ display: 'grid', gap: 4 }}>
 <strong style={{ color: '#0f172a', fontSize: 14 }}>{String(item.stageName || item.id || 'registro')}</strong>
 <span style={{ color: '#64748b', fontSize: 12 }}>Prazo planejado: {String(item.plannedDeadline || '-')}</span>
 </div>
 <span style={{ color: '#64748b', fontSize: 12 }}>{formatCreatedAt(item.createdAt)}</span>
 </div>
 ))}
 </div>
 ) : (
 <div style={{ padding: 8, color: '#64748b', lineHeight: 1.6 }}>Nenhuma etapa registrada ainda para este evento.</div>
 )}
 </SurfaceCard>
 </div>
 </section>
 );
}