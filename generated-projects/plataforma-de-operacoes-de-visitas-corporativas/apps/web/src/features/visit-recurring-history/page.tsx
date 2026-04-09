import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { VisitRecurringHistoryRequest, VisitRecurringHistoryResponse } from '../../../../../packages/shared/src/contracts/visit-recurring-history.ts';
import { FieldGroup, PrimaryButton, SurfaceCard, inputStyle, tokens } from '../../../../../packages/ui/src/index.tsx';
import { visitRecurringHistoryFormSchema, type VisitRecurringHistoryFormValues } from './schema';
import { visitRecurringHistoryQueryKey, createVisitRecurringHistory, fetchVisitRecurringHistoryItems } from './service';
const initialForm: VisitRecurringHistoryFormValues = {
 clientIdentifier: '',
 periodRange: 'ultimos_3_meses',
 visitStatus: 'realizada',
};
function formatCreatedAt(value?: string) {
 if (!value) return 'Agora';
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return 'Agora';
 return parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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
 queryClient.setQueryData<VisitRecurringHistoryResponse[]>(visitRecurringHistoryQueryKey, (current = []) => [created, ...current]);
 reset(initialForm);
 },
 });
 return (
 <section style={{ display: 'grid', gap: 16 }}>
 <header style={{ display: 'grid', gap: 6 }}>
 <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
 Historico de visitas
 </span>
 <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#0f172a' }}>Consulte historico de visitas</h1>
 <p style={{ margin: 0, color: tokens.color.mutedStrong, maxWidth: 760, lineHeight: 1.65 }}>Busque visitas anteriores de um cliente recorrente para reaproveitar dados em um novo agendamento.</p>
 </header>
 <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
 <SurfaceCard title='Cadastro' description='Preencha os campos principais e confirme o registro.'>
 <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values as VisitRecurringHistoryRequest))} style={{ display: 'grid', gap: 14 }}>
 <FieldGroup label='Identificador do cliente' hint='Informe CPF, CNPJ ou ID do cliente para localizar visitas anteriores.'>
 <input {...register('clientIdentifier')} type='text' placeholder='CPF, CNPJ ou ID do cliente' style={inputStyle({ borderRadius: 10, padding: '12px 13px' })} />
 {errors.clientIdentifier ? <small style={{ color: '#b91c1c' }}>{errors.clientIdentifier.message}</small> : null}
 </FieldGroup>
 <FieldGroup label='Periodo' hint='Defina o recorte temporal usado para consultar o historico recorrente.'>
 <select {...register('periodRange')} style={inputStyle({ borderRadius: 10, padding: '12px 13px' })}>
 <option value='ultimos_3_meses'>Ultimos_3_meses</option>
 <option value='ultimos_6_meses'>Ultimos_6_meses</option>
 <option value='ultimos_12_meses'>Ultimos_12_meses</option>
 </select>
 {errors.periodRange ? <small style={{ color: '#b91c1c' }}>{errors.periodRange.message}</small> : null}
 </FieldGroup>
 <FieldGroup label='Status da visita' hint='Mostre apenas visitas realmente aproveitaveis para o novo agendamento.'>
 <select {...register('visitStatus')} style={inputStyle({ borderRadius: 10, padding: '12px 13px' })}>
 <option value='realizada'>Realizada</option>
 <option value='concluida'>Concluida</option>
 </select>
 {errors.visitStatus ? <small style={{ color: '#b91c1c' }}>{errors.visitStatus.message}</small> : null}
 </FieldGroup>
 <PrimaryButton type='submit'>
 {isSubmitting || mutation.isPending ? 'Processando...' : 'Buscar Historico'}
 </PrimaryButton>
 {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>Historico consultado com sucesso.</p> : null}
 {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
 </form>
 </SurfaceCard>
 <SurfaceCard title='Busca do cliente' description='Lista operacional com leitura direta dos campos principais.' meta={isLoading ? 'Carregando...' : `${items.length} itens`}>
 {isLoading ? (
 <div style={{ padding: 8, color: '#64748b' }}>Carregando dados...</div>
 ) : items.length ? (
 <div style={{ display: 'grid' }}>
 {items.map((item) => (
 <div key={String(item.id || Math.random())} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, padding: '12px 0', borderBottom: '1px solid #eef2f7', alignItems: 'center' }}>
 <div style={{ display: 'grid', gap: 4 }}>
 <strong style={{ color: '#0f172a', fontSize: 14 }}>{String(item.clientIdentifier || item.id || 'registro')}</strong>
 <span style={{ color: '#64748b', fontSize: 12 }}>Periodo: {String(item.periodRange || '-')}</span>
 </div>
 <span style={{ color: '#64748b', fontSize: 12 }}>{formatCreatedAt(item.createdAt)}</span>
 </div>
 ))}
 </div>
 ) : (
 <div style={{ padding: 8, color: '#64748b', lineHeight: 1.6 }}>Nenhum historico localizado ainda para o cliente informado.</div>
 )}
 </SurfaceCard>
 </div>
 </section>
 );
}