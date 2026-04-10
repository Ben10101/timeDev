import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { VisitRecurringHistoryRequest, VisitRecurringHistoryResponse } from '../../../../../packages/shared/src/contracts/visit-recurring-history';
import { FieldGroup, PrimaryButton, inputStyle, tokens } from '../../../../../packages/ui/src/index.tsx';
import { visitRecurringHistoryFormSchema, type VisitRecurringHistoryFormValues } from './schema';
import { visitRecurringHistoryQueryKey, createVisitRecurringHistory, fetchVisitRecurringHistoryItems } from './service';
const initialForm: VisitRecurringHistoryFormValues = {
 clientIdentifier: '',
 periodRange: 'ultimos_12_meses',
 visitStatus: 'realizada',
};
const periodLabels = {
 ultimos_3_meses: '3 meses',
 ultimos_6_meses: '6 meses',
 ultimos_12_meses: '12 meses',
} as const;
const statusLabels = {
 realizada: 'Realizada',
 concluida: 'Concluida',
} as const;
function shellPanel(overrides = {}) {
 return {
 background: '#ffffff',
 border: `1px solid ${tokens.color.border}`,
 borderRadius: 16,
 boxShadow: '0 14px 38px rgba(15, 23, 42, 0.06)',
 ...overrides,
 };
}
function formatCreatedAt(value?: string) {
 if (!value) return '--';
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return '--';
 return parsed.toLocaleString('pt-BR', {
 day: '2-digit',
 month: '2-digit',
 hour: '2-digit',
 minute: '2-digit',
 });
}
function normalizePeriod(value?: string) {
 const normalized = String(value || '').trim().toLowerCase();
 return normalized in periodLabels ? (normalized as keyof typeof periodLabels) : 'ultimos_12_meses';
}
function normalizeStatus(value?: string) {
 const normalized = String(value || '').trim().toLowerCase();
 return normalized in statusLabels ? (normalized as keyof typeof statusLabels) : 'realizada';
}
export function VisitRecurringHistoryPage() {
 const queryClient = useQueryClient();
 const { data: items = [], isLoading } = useQuery<VisitRecurringHistoryResponse[]>({
 queryKey: visitRecurringHistoryQueryKey,
 queryFn: fetchVisitRecurringHistoryItems,
 });
 const {
 register,
 handleSubmit,
 reset,
 formState: { errors, isSubmitting },
 } = useForm<VisitRecurringHistoryFormValues>({
 resolver: zodResolver(visitRecurringHistoryFormSchema),
 defaultValues: initialForm,
 });
 const mutation = useMutation({
 mutationFn: (input: VisitRecurringHistoryRequest) => createVisitRecurringHistory(input),
 onSuccess: (created) => {
 queryClient.setQueryData<VisitRecurringHistoryResponse[]>(
 visitRecurringHistoryQueryKey,
 (current = []) => [created, ...current],
 );
 reset(initialForm);
 },
 });
 return (
 <section style={{ display: 'grid', gap: 14 }}>
 <header
 style={{
 ...shellPanel({
 padding: '16px 18px',
 background:
 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)',
 }),
 display: 'grid',
 gap: 10,
 }}
 >
 <div style={{ display: 'grid', gap: 4 }}>
 <div
 style={{
 fontSize: 11,
 fontWeight: 800,
 letterSpacing: '0.08em',
 textTransform: 'uppercase',
 color: tokens.color.muted,
 }}
 >
 Operacao de visitas
 </div>
 <h1
 style={{
 margin: 0,
 fontSize: 28,
 lineHeight: 1.04,
 letterSpacing: '-0.03em',
 color: '#0f172a',
 }}
 >
 Historico de visitas
 </h1>
 <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: tokens.color.mutedStrong }}>
 Consulte visitas anteriores do cliente recorrente para retomar contexto e agilizar um
 novo agendamento com menos retrabalho.
 </p>
 </div>
 </header>
 <div
 style={{
 display: 'grid',
 gridTemplateColumns: '380px minmax(0, 1fr)',
 gap: 14,
 alignItems: 'start',
 }}
 >
 <aside
 style={{
 ...shellPanel({
 padding: 16,
 }),
 display: 'grid',
 gap: 16,
 }}
 >
 <div
 style={{
 padding: '12px 14px',
 borderRadius: 12,
 background: '#f8fafc',
 border: `1px solid ${tokens.color.border}`,
 display: 'grid',
 gap: 4,
 }}
 >
 <strong style={{ color: '#0f172a', fontSize: 14 }}>Nova consulta</strong>
 <span style={{ color: tokens.color.mutedStrong, fontSize: 13, lineHeight: 1.5 }}>
 Informe o cliente, escolha o recorte e filtre apenas visitas reaproveitaveis.
 </span>
 </div>
 <form
 onSubmit={handleSubmit((values) =>
 mutation.mutateAsync({
 clientIdentifier: values.clientIdentifier,
 periodRange: values.periodRange,
 visitStatus: values.visitStatus,
 })
 )}
 style={{ display: 'grid', gap: 14 }}
 >
 <FieldGroup label="Cliente" hint="CPF, CNPJ ou ID do cadastro.">
 <input
 {...register('clientIdentifier')}
 type="text"
 placeholder="CPF, CNPJ ou ID"
 style={inputStyle({ borderRadius: 12, padding: '12px 13px' })}
 />
 {errors.clientIdentifier ? (
 <small style={{ color: tokens.color.danger }}>{errors.clientIdentifier.message}</small>
 ) : null}
 </FieldGroup>
 <FieldGroup label="Periodo" hint="Recorte de visitas mais recentes.">
 <select {...register('periodRange')} style={inputStyle({ borderRadius: 12, padding: '12px 13px' })}>
 <option value="ultimos_3_meses">Ultimos 3 meses</option>
 <option value="ultimos_6_meses">Ultimos 6 meses</option>
 <option value="ultimos_12_meses">Ultimos 12 meses</option>
 </select>
 {errors.periodRange ? (
 <small style={{ color: tokens.color.danger }}>{errors.periodRange.message}</small>
 ) : null}
 </FieldGroup>
 <FieldGroup label="Status" hint="Mostre apenas visitas ja aproveitaveis.">
 <select {...register('visitStatus')} style={inputStyle({ borderRadius: 12, padding: '12px 13px' })}>
 <option value="realizada">Realizada</option>
 <option value="concluida">Concluida</option>
 </select>
 {errors.visitStatus ? (
 <small style={{ color: tokens.color.danger }}>{errors.visitStatus.message}</small>
 ) : null}
 </FieldGroup>
 <div style={{ display: 'grid', gap: 10 }}>
 <PrimaryButton type="submit" accent="teal">
 {isSubmitting || mutation.isPending ? 'Buscando...' : 'Buscar historico'}
 </PrimaryButton>
 <span style={{ color: tokens.color.muted, fontSize: 12, lineHeight: 1.5 }}>
 A consulta atualiza a lista logo ao confirmar o recorte informado.
 </span>
 </div>
 {mutation.isSuccess && mutation.data ? (
 <div
 style={{
 padding: '12px 14px',
 borderRadius: 12,
 background: '#ecfdf3',
 border: '1px solid #86efac',
 display: 'grid',
 gap: 4,
 }}
 >
 <strong style={{ color: '#166534', fontSize: 14 }}>Consulta concluida</strong>
 <span style={{ color: '#166534', fontSize: 13 }}>
 Registro base: <strong>{mutation.data.id}</strong>
 </span>
 </div>
 ) : null}
 {mutation.error ? (
 <div
 style={{
 padding: '12px 14px',
 borderRadius: 12,
 background: '#fef2f2',
 border: '1px solid #fecaca',
 color: '#b91c1c',
 fontSize: 13,
 lineHeight: 1.5,
 }}
 >
 {mutation.error instanceof Error ? mutation.error.message : 'Falha ao consultar historico.'}
 </div>
 ) : null}
 </form>
 </aside>
 <section
 style={{
 ...shellPanel(),
 overflow: 'hidden',
 }}
 >
 <div
 style={{
 display: 'grid',
 gridTemplateColumns: '1fr 132px 112px 144px',
 gap: 10,
 padding: '11px 14px',
 borderBottom: `1px solid ${tokens.color.border}`,
 background: '#f8fafc',
 color: tokens.color.muted,
 fontSize: 11,
 fontWeight: 800,
 letterSpacing: '0.06em',
 textTransform: 'uppercase',
 }}
 >
 <span>Cliente / registro</span>
 <span>Periodo</span>
 <span>Status</span>
 <span>Consultado</span>
 </div>
 {isLoading ? (
 <div style={{ display: 'grid' }}>
 {[0, 1, 2, 3].map((placeholder) => (
 <div
 key={placeholder}
 style={{
 height: 54,
 borderBottom: `1px solid ${tokens.color.border}`,
 background: placeholder % 2 === 0 ? '#ffffff' : '#fbfcfe',
 }}
 />
 ))}
 </div>
 ) : items.length ? (
 <div style={{ display: 'grid' }}>
 {items.map((item, index) => (
 <div
 key={item.id}
 style={{
 display: 'grid',
 gridTemplateColumns: '1fr 132px 112px 144px',
 gap: 10,
 padding: '12px 14px',
 borderBottom: `1px solid ${tokens.color.border}`,
 background: index % 2 === 0 ? '#ffffff' : '#fbfcfe',
 alignItems: 'center',
 }}
 >
 <div style={{ display: 'grid', gap: 3 }}>
 <strong style={{ color: '#0f172a', fontSize: 14 }}>
 {String(item.clientIdentifier || item.id)}
 </strong>
 <span
 style={{
 color: tokens.color.muted,
 fontSize: 11,
 fontFamily: '"Consolas", "SFMono-Regular", monospace',
 }}
 >
 ID {item.id.slice(0, 8)}
 </span>
 </div>
 <span style={{ color: tokens.color.mutedStrong, fontSize: 12 }}>
 {periodLabels[normalizePeriod(item.periodRange)]}
 </span>
 <span style={{ color: tokens.color.mutedStrong, fontSize: 12 }}>
 {statusLabels[normalizeStatus(item.visitStatus)]}
 </span>
 <span style={{ color: tokens.color.mutedStrong, fontSize: 12 }}>
 {formatCreatedAt(item.createdAt)}
 </span>
 </div>
 ))}
 </div>
 ) : (
 <div
 style={{
 padding: 20,
 color: tokens.color.mutedStrong,
 lineHeight: 1.6,
 }}
 >
 Nenhum historico localizado ainda para o cliente consultado. O primeiro resultado deve aparecer aqui com recorte e status reaproveitavel.
 </div>
 )}
 </section>
 </div>
 </section>
 );
}