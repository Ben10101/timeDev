import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { VisitOperationalResponsibleRequest, VisitOperationalResponsibleResponse } from '../../../../../packages/shared/src/contracts/visit-operational-responsibles.ts';
import { FieldGroup, PrimaryButton, SurfaceCard, inputStyle, tokens } from '../../../../../packages/ui/src/index.tsx';
import { visitOperationalResponsibleFormSchema, type VisitOperationalResponsibleFormValues } from './schema';
import { visitOperationalResponsibleQueryKey, createVisitOperationalResponsible, fetchVisitOperationalResponsibleItems } from './service';
const initialForm: VisitOperationalResponsibleFormValues = {
 responsibleName: '',
 contact: '',
 supportType: 'tecnico',
};
function formatCreatedAt(value?: string) {
 if (!value) return 'Agora';
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return 'Agora';
 return parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
export function VisitOperationalResponsiblesPage() {
 const queryClient = useQueryClient();
 const { data: items = [], isLoading } = useQuery<VisitOperationalResponsibleResponse[]>({
 queryKey: visitOperationalResponsibleQueryKey,
 queryFn: fetchVisitOperationalResponsibleItems,
 });
 const {
 register,
 handleSubmit,
 reset,
 formState: { errors, isSubmitting },
 } = useForm<VisitOperationalResponsibleFormValues>({
 resolver: zodResolver(visitOperationalResponsibleFormSchema),
 defaultValues: initialForm,
 });
 const mutation = useMutation({
 mutationFn: (input: VisitOperationalResponsibleRequest) => createVisitOperationalResponsible(input),
 onSuccess: (created) => {
 queryClient.setQueryData<VisitOperationalResponsibleResponse[]>(visitOperationalResponsibleQueryKey, (current = []) => [created, ...current]);
 reset(initialForm);
 },
 });
 return (
 <section style={{ display: 'grid', gap: 16 }}>
 <header style={{ display: 'grid', gap: 6 }}>
 <span style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
 Responsaveis
 </span>
 <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.05, letterSpacing: '-0.03em', color: '#0f172a' }}>Cadastre responsaveis operacionais</h1>
 <p style={{ margin: 0, color: tokens.color.mutedStrong, maxWidth: 760, lineHeight: 1.65 }}>Registre quem apoia a operacao da visita com nome, contato e tipo de suporte.</p>
 </header>
 <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
 <SurfaceCard title='Cadastro' description='Preencha os campos principais e confirme o registro.'>
 <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values as VisitOperationalResponsibleRequest))} style={{ display: 'grid', gap: 14 }}>
 <FieldGroup label='Nome do responsavel operacional' hint='Informe o nome de quem apoia a operacao desta visita.'>
 <input {...register('responsibleName')} type='text' placeholder='Ex.: Joao Silva' style={inputStyle({ borderRadius: 10, padding: '12px 13px' })} />
 {errors.responsibleName ? <small style={{ color: '#b91c1c' }}>{errors.responsibleName.message}</small> : null}
 </FieldGroup>
 <FieldGroup label='Contato' hint='Registre um e-mail ou telefone com DDD para acionamento rapido.'>
 <input {...register('contact')} type='text' placeholder='joao@empresa.com ou (11) 98765-4321' style={inputStyle({ borderRadius: 10, padding: '12px 13px' })} />
 {errors.contact ? <small style={{ color: '#b91c1c' }}>{errors.contact.message}</small> : null}
 </FieldGroup>
 <FieldGroup label='Tipo de suporte' hint='Selecione o tipo principal de apoio prestado por este responsavel.'>
 <select {...register('supportType')} style={inputStyle({ borderRadius: 10, padding: '12px 13px' })}>
 <option value='tecnico'>Tecnico</option>
 <option value='logistica'>Logistica</option>
 <option value='seguranca'>Seguranca</option>
 <option value='apoio'>Apoio</option>
 </select>
 {errors.supportType ? <small style={{ color: '#b91c1c' }}>{errors.supportType.message}</small> : null}
 </FieldGroup>
 <PrimaryButton type='submit'>
 {isSubmitting || mutation.isPending ? 'Processando...' : 'Cadastrar Responsavel'}
 </PrimaryButton>
 {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>Responsavel operacional cadastrado com sucesso.</p> : null}
 {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
 </form>
 </SurfaceCard>
 <SurfaceCard title='Responsaveis operacionais' description='Lista operacional com leitura direta dos campos principais.' meta={isLoading ? 'Carregando...' : `${items.length} itens`}>
 {isLoading ? (
 <div style={{ padding: 8, color: '#64748b' }}>Carregando dados...</div>
 ) : items.length ? (
 <div style={{ display: 'grid' }}>
 {items.map((item) => (
 <div key={String(item.id || Math.random())} style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 10, padding: '12px 0', borderBottom: '1px solid #eef2f7', alignItems: 'center' }}>
 <div style={{ display: 'grid', gap: 4 }}>
 <strong style={{ color: '#0f172a', fontSize: 14 }}>{String(item.responsibleName || item.id || 'registro')}</strong>
 <span style={{ color: '#64748b', fontSize: 12 }}>Contato: {String(item.contact || '-')}</span>
 </div>
 <span style={{ color: '#64748b', fontSize: 12 }}>{formatCreatedAt(item.createdAt)}</span>
 </div>
 ))}
 </div>
 ) : (
 <div style={{ padding: 8, color: '#64748b', lineHeight: 1.6 }}>Nenhum responsavel operacional cadastrado ainda para esta operacao.</div>
 )}
 </SurfaceCard>
 </div>
 </section>
 );
}