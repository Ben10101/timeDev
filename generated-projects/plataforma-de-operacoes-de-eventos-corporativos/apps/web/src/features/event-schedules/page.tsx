import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { EventScheduleRequest, EventScheduleResponse } from '../../../../../packages/shared/src/contracts/event-schedules.ts';
import { FeatureWorkbench, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { eventScheduleFormSchema, type EventScheduleFormValues } from './schema';
import { eventScheduleQueryKey, createEventSchedule, fetchEventScheduleItems } from './service';
const initialForm: EventScheduleFormValues = {
 stageName: '',
 plannedDeadline: '',
 executionNotes: '',
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
 <FeatureWorkbench
 accent="teal"
 productMode="timeline-planner"
 uiIntent="plan"
 layoutVariant="balanced-split"
 pageArchetype=""
 fallbackPattern=""
 patternHints={[]}
 sections={["hero","queue","filters","records"]}
 componentMap={{"recordsLead":"queueRail","activity":null}}
 eyebrow="Cronograma"
 title="Monte o cronograma inicial do evento"
 description="Organize etapas, prazos e responsaveis para manter a execucao do evento previsivel desde o planejamento."
 highlights={["Fluxo desenhado para reduzir duvidas e acelerar a conclusao.","Leitura clara do que precisa ser feito agora.","Fila viva com contexto suficiente para decidir rapido."]}
 formTitle="Concluir operacao"
 formDescription="Preencha as informacoes essenciais para concluir esta etapa com seguranca e contexto."
 form={
 <form onSubmit={handleSubmit((values) => mutation.mutateAsync({
 stageName: values.stageName,
 plannedDeadline: values.plannedDeadline,
 executionNotes: values.executionNotes,
 }))} style={{ display: 'grid', gap: 18 }}>
 <FieldGroup label="Etapa do cronograma" hint="Nomeie a etapa principal para deixar o plano facil de acompanhar.">
 <input
 {...register('stageName')}
 type="text"
 placeholder="Ex.: Confirmacao de fornecedores"
 style={inputStyle()}
 />
 {errors.stageName ? <small style={{ color: '#b91c1c' }}>{errors.stageName.message}</small> : null}
 </FieldGroup>
 <FieldGroup label="Prazo planejado" hint="Defina a data alvo dessa etapa para dar previsibilidade ao time.">
 <input
 {...register('plannedDeadline')}
 type="date"
 placeholder="2026-04-20"
 style={inputStyle()}
 />
 {errors.plannedDeadline ? <small style={{ color: '#b91c1c' }}>{errors.plannedDeadline.message}</small> : null}
 </FieldGroup>
 <FieldGroup label="Notas operacionais" hint="Registre o contexto minimo da etapa para facilitar a execucao e o handoff.">
 <textarea
 {...register('executionNotes')}
 placeholder="Dependencias, criterio de prontidao e observacoes importantes."
 style={inputStyle({ minHeight: 132, resize: 'vertical' })}
 />
 {errors.executionNotes ? <small style={{ color: '#b91c1c' }}>{errors.executionNotes.message}</small> : null}
 </FieldGroup>
 <PrimaryButton type="submit" accent="teal">
 {isSubmitting || mutation.isPending ? 'Processando...' : 'Adicionar Etapa'}
 </PrimaryButton>
 {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>"Etapa do cronograma registrada com sucesso."</p> : null}
 {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
 </form>
 }
 listTitle="Fila ativa"
 listDescription="Nenhum item ativo ainda."
 listMeta={isLoading ? 'Atualizando' : items.length ? `${items.length} registro(s)` : 'Nenhum registro'}
 >
 <div style={{ display: 'grid', gap: 10 }}>
 {isLoading ? (
 <div style={{ display: 'grid', gap: 10 }}>
 {[0, 1, 2].map((placeholder) => (
 <div key={placeholder} style={{ padding: '18px 16px', borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0', minHeight: 74 }} />
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
 gridTemplateColumns: '1.2fr 0.8fr 0.8fr',
 gap: 12,
 alignItems: 'center',
 }}
 >
 <div style={{ display: 'grid', gap: 4 }}>
 <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{String(item.stageName || item.id)}</strong>
 <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.plannedDeadline || 'Item pronto para priorizacao')}</span>
 </div>
 <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#f3e8ff', color: '#7c3aed', fontSize: 12, fontWeight: 700 }}>
 {humanizeStatus(String(item.status || 'pending'))}
 </span>
 <span style={{ color: '#64748b', fontSize: 13 }}>{formatCreatedAt(String(item.createdAt || ''))}</span>
 </article>
 ))
 ) : (
 <div style={{ padding: 28, borderRadius: 16, background: '#faf5ff', border: '1px dashed #d8b4fe', textAlign: 'center' }}>
 <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'grid', placeItems: 'center', fontSize: 24 }}>!</div>
 <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>"Nenhum item ativo ainda."</p>
 </div>
 )}
 </div>
 </FeatureWorkbench>
 );
}