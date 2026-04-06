import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { EventSupplierRequest, EventSupplierResponse } from '../../../../../packages/shared/src/contracts/event-suppliers.ts';
import { FeatureWorkbench, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { eventSupplierFormSchema, type EventSupplierFormValues } from './schema';
import { eventSupplierQueryKey, createEventSupplier, fetchEventSupplierItems } from './service';
const initialForm: EventSupplierFormValues = {
 supplierName: '',
 serviceCategory: 'buffet',
 primaryContacts: '',
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
export function EventSuppliersPage() {
 const queryClient = useQueryClient();
 const { data: items = [], isLoading } = useQuery<EventSupplierResponse[]>({
 queryKey: eventSupplierQueryKey,
 queryFn: fetchEventSupplierItems,
 });
 const {
 register,
 handleSubmit,
 reset,
 formState: { errors, isSubmitting },
 } = useForm<EventSupplierFormValues>({
 resolver: zodResolver(eventSupplierFormSchema),
 defaultValues: initialForm,
 });
 const mutation = useMutation({
 mutationFn: (input: EventSupplierRequest) => createEventSupplier(input),
 onSuccess: (created) => {
 queryClient.setQueryData<EventSupplierResponse[]>(eventSupplierQueryKey, (current = []) => [created, ...current]);
 reset(initialForm);
 },
 });
 return (
 <FeatureWorkbench
 accent="teal"
 productMode="vendor-registry"
 uiIntent="register"
 layoutVariant="balanced-split"
 pageArchetype=""
 fallbackPattern=""
 patternHints={[]}
 sections={["hero","queue","filters","records"]}
 componentMap={{"recordsLead":"queueRail","activity":null}}
 eyebrow="Fornecedores"
 title="Cadastre fornecedores da operacao"
 description="Centralize parceiros com categoria de servico e contatos principais para acionar a operacao com menos retrabalho."
 highlights={["Fluxo desenhado para reduzir duvidas e acelerar a conclusao.","Leitura clara do que precisa ser feito agora.","Fila viva com contexto suficiente para decidir rapido."]}
 formTitle="Concluir operacao"
 formDescription="Preencha as informacoes essenciais para concluir esta etapa com seguranca e contexto."
 form={
 <form onSubmit={handleSubmit((values) => mutation.mutateAsync({
 supplierName: values.supplierName,
 serviceCategory: values.serviceCategory,
 primaryContacts: values.primaryContacts,
 }))} style={{ display: 'grid', gap: 18 }}>
 <FieldGroup label="Nome do fornecedor" hint="Use o nome comercial do parceiro para facilitar busca e reutilizacao em novos eventos.">
 <input
 {...register('supplierName')}
 type="text"
 placeholder="Ex.: Buffet Sabor & Arte"
 style={inputStyle()}
 />
 {errors.supplierName ? <small style={{ color: '#b91c1c' }}>{errors.supplierName.message}</small> : null}
 </FieldGroup>
 <FieldGroup label="Categoria de servico" hint="Classifique o tipo principal de servico que este fornecedor entrega.">
 <select
 {...register('serviceCategory')}
 style={inputStyle()}
 >
 <option value="buffet">Buffet</option>
 <option value="audiovisual">Audiovisual</option>
 <option value="brindes">Brindes</option>
 <option value="recepcao">Recepcao</option>
 <option value="cenografia">Cenografia</option>
 <option value="transporte">Transporte</option>
 <option value="outro">Outro</option>
 </select>
 {errors.serviceCategory ? <small style={{ color: '#b91c1c' }}>{errors.serviceCategory.message}</small> : null}
 </FieldGroup>
 <FieldGroup label="Contatos principais" hint="Registre pelo menos um contato com nome, canal e referencia para acionamento rapido.">
 <textarea
 {...register('primaryContacts')}
 placeholder="Nome | cargo | telefone | e-mail"
 style={inputStyle({ minHeight: 132, resize: 'vertical' })}
 />
 {errors.primaryContacts ? <small style={{ color: '#b91c1c' }}>{errors.primaryContacts.message}</small> : null}
 </FieldGroup>
 <PrimaryButton type="submit" accent="teal">
 {isSubmitting || mutation.isPending ? 'Processando...' : 'Cadastrar Fornecedor'}
 </PrimaryButton>
 {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>"Fornecedor cadastrado com sucesso."</p> : null}
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
 <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{String(item.supplierName || item.id)}</strong>
 <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.serviceCategory || 'Item pronto para priorizacao')}</span>
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