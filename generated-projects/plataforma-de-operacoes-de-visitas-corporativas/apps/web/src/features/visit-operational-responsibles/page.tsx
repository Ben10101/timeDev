import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { VisitOperationalResponsibleRequest, VisitOperationalResponsibleResponse } from '../../../../../packages/shared/src/contracts/visit-operational-responsibles';
import { FieldGroup, PrimaryButton, inputStyle, tokens } from '../../../../../packages/ui/src/index.tsx';
import { visitOperationalResponsibleFormSchema, type VisitOperationalResponsibleFormValues } from './schema';
import { visitOperationalResponsibleQueryKey, createVisitOperationalResponsible, fetchVisitOperationalResponsibleItems } from './service';
const initialForm: VisitOperationalResponsibleFormValues = {
 responsibleName: '',
 contact: '',
 supportType: 'tecnico',
};
const supportCatalog = {
 tecnico: { label: 'Tecnico', tone: '#0f766e', soft: '#dcfce7' },
 logistica: { label: 'Logistica', tone: '#b45309', soft: '#fef3c7' },
 seguranca: { label: 'Seguranca', tone: '#1d4ed8', soft: '#dbeafe' },
 apoio: { label: 'Apoio', tone: '#7c3aed', soft: '#ede9fe' },
} as const;
function formatCreatedAt(value?: string) {
 if (!value) return 'Agora';
 const parsed = new Date(value);
 if (Number.isNaN(parsed.getTime())) return 'Agora';
 return parsed.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
function normalizeSupportType(value?: string) {
 const normalized = String(value || '').trim().toLowerCase();
 return normalized in supportCatalog ? (normalized as keyof typeof supportCatalog) : 'apoio';
}
function formatContactChannel(value?: string) {
 return String(value || '').includes('@') ? 'E-mail' : 'Telefone';
}
function panelStyle(overrides = {}) {
 return {
 border: `1px solid ${tokens.color.border}`,
 borderRadius: 12,
 background: '#ffffff',
 ...overrides,
 };
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
 const groupedItems = (['seguranca', 'logistica', 'tecnico', 'apoio'] as const).map((type) => ({
 type,
 meta: supportCatalog[type],
 items: items.filter((item) => normalizeSupportType(item.supportType) === type),
 }));
 return (
 <section style={{ display: 'grid', gap: 12 }}>
 <header style={{ ...panelStyle({ padding: 16, background: '#f8fafc' }), display: 'grid', gap: 6 }}>
 <div style={{ display: 'flex', gap: 16, alignItems: 'start' }}>
 <div style={{ display: 'grid', gap: 4 }}>
 <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
 Operacao de visitas
 </div>
 <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.08, letterSpacing: '-0.03em', color: '#0f172a' }}>
 Responsaveis operacionais
 </h1>
 <p style={{ margin: 0, color: tokens.color.mutedStrong, maxWidth: 760, lineHeight: 1.55, fontSize: 14 }}>
 Cadastre os contatos que apoiam a visita para facilitar o acionamento por tipo de suporte durante a operacao.
 </p>
 </div>
 </div>
 </header>
 <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
 <aside style={{ ...panelStyle(), padding: 14, display: 'grid', gap: 14 }}>
 <div style={{ display: 'grid', gap: 2 }}>
 <strong style={{ color: '#0f172a', fontSize: 15 }}>Novo responsavel</strong>
 <span style={{ color: tokens.color.mutedStrong, fontSize: 13, lineHeight: 1.5 }}>
 Nome, contato e tipo de suporte. O restante deve ser comportamento da tela, nao explicacao.
 </span>
 </div>
 <form
 onSubmit={handleSubmit((values) =>
 mutation.mutateAsync({
 responsibleName: values.responsibleName,
 contact: values.contact,
 supportType: values.supportType,
 })
 )}
 style={{ display: 'grid', gap: 14 }}
 >
 <FieldGroup label="Nome" hint="Identificacao principal para a recepcao.">
 <input {...register('responsibleName')} type="text" placeholder="Joao Silva" style={inputStyle({ borderRadius: 10, padding: '12px 13px' })} />
 {errors.responsibleName ? <small style={{ color: tokens.color.danger }}>{errors.responsibleName.message}</small> : null}
 </FieldGroup>
 <FieldGroup label="Contato" hint="E-mail ou telefone com DDD.">
 <input {...register('contact')} type="text" placeholder="joao@empresa.com" style={inputStyle({ borderRadius: 10, padding: '12px 13px' })} />
 {errors.contact ? <small style={{ color: tokens.color.danger }}>{errors.contact.message}</small> : null}
 </FieldGroup>
 <FieldGroup label="Tipo de suporte" hint="Categoria principal de apoio.">
 <select {...register('supportType')} style={inputStyle({ borderRadius: 10, padding: '12px 13px' })}>
 <option value="tecnico">Tecnico</option>
 <option value="logistica">Logistica</option>
 <option value="seguranca">Seguranca</option>
 <option value="apoio">Apoio</option>
 </select>
 {errors.supportType ? <small style={{ color: tokens.color.danger }}>{errors.supportType.message}</small> : null}
 </FieldGroup>
 <div style={{ display: 'grid', gap: 10 }}>
 <PrimaryButton type="submit" accent="teal">
 {isSubmitting || mutation.isPending ? 'Salvando...' : 'Cadastrar responsavel'}
 </PrimaryButton>
 <span style={{ color: tokens.color.muted, fontSize: 12, lineHeight: 1.5 }}>
 O cadastro aparece na lista logo apos a confirmacao.
 </span>
 </div>
 {mutation.isSuccess && mutation.data ? (
 <div style={{ padding: '11px 12px', borderRadius: 10, background: '#ecfdf3', border: '1px solid #86efac', display: 'grid', gap: 4 }}>
 <strong style={{ color: '#166534' }}>Cadastro concluido</strong>
 <span style={{ color: '#166534', fontSize: 13 }}>
 ID gerado: <strong>{mutation.data.id}</strong>
 </span>
 </div>
 ) : null}
 {mutation.error ? (
 <div style={{ padding: '11px 12px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: 13, lineHeight: 1.5 }}>
 {mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}
 </div>
 ) : null}
 </form>
 </aside>
 <section style={{ ...panelStyle(), overflow: 'hidden' }}>
 <div style={{ padding: '12px 14px', borderBottom: `1px solid ${tokens.color.border}`, background: '#f8fafc', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
 <div style={{ display: 'grid', gap: 2 }}>
 <strong style={{ color: '#0f172a', fontSize: 15 }}>Registro ativo</strong>
 <span style={{ color: tokens.color.muted, fontSize: 13 }}>
 Conferencia por tipo, contato e data de criacao.
 </span>
 </div>
 <div style={{ color: tokens.color.mutedStrong, fontSize: 12, fontWeight: 700 }}>
 {isLoading ? 'Carregando dados...' : `${items.length} itens no total`}
 </div>
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }}>
 <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 128px 92px 144px', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${tokens.color.border}`, fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: tokens.color.muted, background: '#ffffff' }}>
 <span>Responsavel</span>
 <span>Contato</span>
 <span>Suporte</span>
 <span>Canal</span>
 <span>Criado</span>
 </div>
 {isLoading ? (
 <div style={{ display: 'grid', gap: 0 }}>
 {[0, 1, 2, 3].map((placeholder) => (
 <div key={placeholder} style={{ height: 52, borderBottom: `1px solid ${tokens.color.border}`, background: placeholder % 2 === 0 ? '#ffffff' : '#fbfcfe' }} />
 ))}
 </div>
 ) : items.length ? (
 <div style={{ display: 'grid' }}>
 {groupedItems.flatMap((group) =>
 group.items.map((item, index) => (
 <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 128px 92px 144px', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${tokens.color.border}`, background: index % 2 === 0 ? '#ffffff' : '#fbfcfe', alignItems: 'center' }}>
 <div style={{ display: 'grid', gap: 3 }}>
 <strong style={{ color: '#0f172a', fontSize: 14 }}>{item.responsibleName}</strong>
 <span style={{ color: tokens.color.muted, fontSize: 11, fontFamily: '"Consolas", "SFMono-Regular", monospace' }}>ID {item.id.slice(0, 8)}</span>
 </div>
 <span style={{ color: tokens.color.mutedStrong, fontSize: 13 }}>{item.contact}</span>
 <span style={{ width: 'fit-content', padding: '4px 8px', borderRadius: 999, background: group.meta.soft, color: group.meta.tone, fontSize: 11, fontWeight: 800 }}>
 {group.meta.label}
 </span>
 <span style={{ color: tokens.color.mutedStrong, fontSize: 12 }}>
 {formatContactChannel(item.contact)}
 </span>
 <span style={{ color: tokens.color.mutedStrong, fontSize: 12 }}>
 {formatCreatedAt(item.createdAt)}
 </span>
 </div>
 )),
 )}
 </div>
 ) : (
 <div style={{ padding: 20, color: tokens.color.mutedStrong, lineHeight: 1.6 }}>
 Nenhum responsavel operacional cadastrado ainda. O primeiro registro deve aparecer aqui assim que o envio for concluido.
 </div>
 )}
 </div>
 </section>
 </div>
 </section>
 );
}