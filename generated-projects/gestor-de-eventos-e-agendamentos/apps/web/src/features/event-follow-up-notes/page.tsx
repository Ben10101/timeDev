import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { EventFollowUpNoteRequest, EventFollowUpNoteResponse } from '../../../../../packages/shared/src/contracts/event-follow-up-notes';
import { FieldGroup, PrimaryButton, SurfaceCard, MetricRow, Badge, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { eventFollowUpNoteFormSchema, type EventFollowUpNoteFormValues } from './schema';
import { eventFollowUpNoteQueryKey, createEventFollowUpNote, fetchEventFollowUpNoteItems } from './service';
const initialForm: EventFollowUpNoteFormValues = {
 eventId: '',
 noteText: '',
};
const guidanceItems = ["Cada observacao deve ficar vinculada a um evento existente antes de ser registrada.","O texto da observacao e obrigatorio e precisa trazer contexto suficiente para leitura operacional, com minimo de 10 e maximo de 1000 caracteres.","O sistema deve registrar automaticamente autor e data/hora para manter rastreabilidade do acompanhamento."];
const highlightItems = [];
function humanizeStatus(value?: string) {
 const normalized = String(value || '').trim().toLowerCase();
 const directMap: Record<string, string> = {
 active: 'Ativo',
 enabled: 'Ativado',
 disabled: 'Desativado',
 draft: 'Em preparacao',
 pending: 'Pendente',
 review: 'Em revisao',
 };
 return directMap[normalized] || (value ? String(value) : 'Ativo');
}
function formatCreatedAt(value?: string) {
 if (!value) return 'Agora';
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return 'Agora';
 return parsed.toLocaleString('pt-BR', {
 day: '2-digit',
 month: '2-digit',
 hour: '2-digit',
 minute: '2-digit',
 });
}
function badgeColors(accent = 'teal') {
 if (accent === 'amber') {
 return { soft: '#ffedd5', strong: '#b45309', border: '#fdba74' };
 }
 if (accent === 'blue') {
 return { soft: '#dbeafe', strong: '#2451b7', border: '#93c5fd' };
 }
 if (accent === 'violet') {
 return { soft: '#ede9fe', strong: '#6d28d9', border: '#c4b5fd' };
 }
 return { soft: '#ccfbf1', strong: '#0f766e', border: '#5eead4' };
}
export function EventFollowUpNotesPage() {
 const queryClient = useQueryClient();
 const { data: items = [], isLoading } = useQuery<EventFollowUpNoteResponse[]>({
 queryKey: eventFollowUpNoteQueryKey,
 queryFn: fetchEventFollowUpNoteItems,
 });
 const {
 register,
 handleSubmit,
 reset,
 formState: { errors, isSubmitting },
 } = useForm<EventFollowUpNoteFormValues>({
 resolver: zodResolver(eventFollowUpNoteFormSchema),
 defaultValues: initialForm,
 });
 const mutation = useMutation({
 mutationFn: (input: EventFollowUpNoteRequest) => createEventFollowUpNote(input),
 onSuccess: (created) => {
 queryClient.setQueryData<EventFollowUpNoteResponse[]>(eventFollowUpNoteQueryKey, (current = []) => [created, ...current]);
 reset(initialForm);
 },
 });
 const accent = badgeColors();
 const latestItem = items[0];
 return (
 <section style={{ display: 'grid', gap: 18 }}>
 <section
 style={{
 padding: 22,
 borderRadius: 28,
 background: 'linear-gradient(140deg, rgba(255,255,255,0.98) 0%, rgba(241,245,249,0.98) 42%, rgba(248,250,252,0.98) 100%)',
 border: '1px solid #dbe4ee',
 boxShadow: '0 18px 38px rgba(15, 23, 42, 0.08)',
 display: 'grid',
 gap: 16,
 }}
 >
 <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
 <div style={{ display: 'grid', gap: 8, maxWidth: 820 }}>
 <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#64748b' }}>
 "Observacoes do evento"
 </div>
 <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.02, letterSpacing: '-0.04em', color: '#0f172a' }}>
 "Registre observacoes de acompanhamento"
 </h1>
 <p style={{ margin: 0, color: '#475569', lineHeight: 1.75, fontSize: 15 }}>
 "Anexe notas operacionais ao evento para dar contexto rapido sobre prioridades, riscos e pendencias."
 </p>
 </div>
 <div style={{ display: 'grid', gap: 10, justifyItems: 'end' }}>
 <span
 style={{
 display: 'inline-flex',
 padding: '8px 12px',
 borderRadius: 999,
 background: accent.soft,
 color: accent.strong,
 fontSize: 12,
 fontWeight: 800,
 letterSpacing: '0.08em',
 textTransform: 'uppercase',
 }}
 >
 "operations-queue"
 </span>
 <div style={{ color: '#64748b', fontSize: 13 }}>
 "Registrar Observacao" como proxima acao principal
 </div>
 </div>
 </div>
 <MetricRow
 items={[
 { label: 'Registros', value: isLoading ? '...' : String(items.length) },
 { label: 'Ultima atualizacao', value: latestItem ? formatCreatedAt(String(latestItem.createdAt || '')) : 'Agora' },
 { label: 'Foco', value: "Registre observacoes de acompanhamento" },
 ]}
 />
 </section>
 <section
 style={{
 display: 'grid',
 gridTemplateColumns: 'minmax(0, 1.35fr) minmax(320px, 0.9fr)',
 gap: 18,
 alignItems: 'start',
 }}
 >
 <div style={{ display: 'grid', gap: 18 }}>
 <SurfaceCard
 title="Observacoes recentes"
 description="Nenhuma observacao registrada ainda para este evento."
 meta={isLoading ? 'Atualizando' : items.length ? items.length + ' registro(s)' : 'Sem registros'}
 background="#ffffff"
 >
 <div style={{ display: 'grid', gap: 12 }}>
 {isLoading ? (
 <div style={{ display: 'grid', gap: 12 }}>
 {[0, 1, 2].map((placeholder) => (
 <div key={placeholder} style={{ minHeight: 110, borderRadius: 18, background: '#f8fafc', border: '1px solid #e2e8f0' }} />
 ))}
 </div>
 ) : items.length ? (
 items.map((item, index) => (
 <article
 key={item.id}
 style={{
 display: 'grid',
 gap: 12,
 padding: '18px 18px 18px 20px',
 borderRadius: 20,
 border: '1px solid #dbe4ee',
 background: index === 0 ? '#fcfffd' : '#ffffff',
 boxShadow: index === 0 ? '0 12px 24px rgba(15, 23, 42, 0.05)' : 'none',
 borderLeft: `6px solid ${accent.strong}`,
 }}
 >
 <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', flexWrap: 'wrap' }}>
 <div style={{ display: 'grid', gap: 6 }}>
 <strong style={{ color: '#0f172a', fontSize: 16 }}>
 {String(item.eventId || item.id)}
 </strong>
 <div style={{ color: '#475569', fontSize: 14, lineHeight: 1.7 }}>
 {String(item.noteText || 'Registro pronto para leitura operacional.')}
 </div>
 </div>
 <Badge subtle>{humanizeStatus(String(item.status || 'active'))}</Badge>
 </div>
 <div
 style={{
 display: 'grid',
 gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
 gap: 12,
 alignItems: 'start',
 }}
 >
 <div style={{ padding: '12px 14px', borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
 <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>Referencia</div>
 <div style={{ marginTop: 6, color: '#0f172a', fontSize: 14, lineHeight: 1.6 }}>
 {String(item.noteText || item.id)}
 </div>
 </div>
 <div style={{ padding: '12px 14px', borderRadius: 14, background: accent.soft, border: `1px solid ${accent.border}` }}>
 <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent.strong, fontWeight: 800 }}>Atualizado em</div>
 <div style={{ marginTop: 6, color: '#0f172a', fontSize: 14, lineHeight: 1.6 }}>
 {formatCreatedAt(String(item.createdAt || ''))}
 </div>
 </div>
 </div>
 </article>
 ))
 ) : (
 <div style={{ padding: 30, borderRadius: 18, background: '#f8fafc', border: '1px dashed #cbd5e1', display: 'grid', gap: 8, textAlign: 'center' }}>
 <div style={{ fontSize: 28 }}>+</div>
 <strong style={{ color: '#0f172a', fontSize: 16 }}>"Observacoes recentes"</strong>
 <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>
 "Nenhuma observacao registrada ainda para este evento."
 </p>
 </div>
 )}
 </div>
 </SurfaceCard>
 </div>
 <div style={{ display: 'grid', gap: 18 }}>
 <SurfaceCard
 title="Registre observacoes de acompanhamento"
 description="Anexe notas operacionais ao evento para dar contexto rapido sobre prioridades, riscos e pendencias."
 background="#ffffff"
 >
 <form onSubmit={handleSubmit((values) => mutation.mutateAsync({
 eventId: values.eventId,
 noteText: values.noteText,
 }))} style={{ display: 'grid', gap: 18 }}>
 <FieldGroup label="Evento" hint="Informe o identificador do evento ao qual a observacao sera vinculada.">
 <input
 {...register('eventId')}
 type="text"
 placeholder="UUID do evento"
 style={inputStyle()}
 />
 {errors.eventId ? <small style={{ color: '#b91c1c' }}>{errors.eventId.message}</small> : null}
 </FieldGroup>
 <FieldGroup label="Observacao de acompanhamento" hint="Registre a nota de contexto que ajuda a explicar prioridades, riscos ou pendencias do evento.">
 <textarea
 {...register('noteText')}
 placeholder="Descreva a observacao operacional que deve acompanhar este evento."
 style={inputStyle({ minHeight: 132, resize: 'vertical' })}
 />
 {errors.noteText ? <small style={{ color: '#b91c1c' }}>{errors.noteText.message}</small> : null}
 </FieldGroup>
 <PrimaryButton type="submit" accent="teal">
 {isSubmitting || mutation.isPending ? 'Processando...' : 'Registrar Observacao'}
 </PrimaryButton>
 {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>"Observacao registrada com sucesso."</p> : null}
 {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
 </form>
 </SurfaceCard>
 <SurfaceCard
 title="Leitura operacional"
 description="Sinais e combinados para manter a captura mais util para decisao."
 meta={highlightItems.length ? String(highlightItems.length) + ' sinais' : 'Guia rapido'}
 background="#f8fafc"
 >
 <div style={{ display: 'grid', gap: 12 }}>
 {highlightItems.map((item, index) => (
 <div key={index} style={{ padding: '12px 14px', borderRadius: 14, background: '#ffffff', border: '1px solid #e2e8f0', color: '#334155', lineHeight: 1.7 }}>
 {item}
 </div>
 ))}
 {guidanceItems.length ? (
 <div style={{ display: 'grid', gap: 10 }}>
 {guidanceItems.map((item, index) => (
 <div key={index} style={{ display: 'grid', gridTemplateColumns: '20px 1fr', gap: 10, alignItems: 'start' }}>
 <div style={{ width: 20, height: 20, borderRadius: '50%', background: accent.soft, color: accent.strong, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>
 {index + 1}
 </div>
 <div style={{ color: '#475569', lineHeight: 1.7 }}>{item}</div>
 </div>
 ))}
 </div>
 ) : null}
 </div>
 </SurfaceCard>
 </div>
 </section>
 </section>
 );
}