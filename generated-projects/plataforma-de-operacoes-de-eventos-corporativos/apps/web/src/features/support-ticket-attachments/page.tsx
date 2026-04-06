import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { SupportTicketAttachmentRequest, SupportTicketAttachmentResponse } from '../../../../../packages/shared/src/contracts/support-ticket-attachments.ts';
import { FeatureWorkbench, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { supportTicketAttachmentFormSchema, type SupportTicketAttachmentFormValues } from './schema';
import { supportTicketAttachmentQueryKey, createSupportTicketAttachment, fetchSupportTicketAttachmentItems } from './service';
const initialForm: SupportTicketAttachmentFormValues = {
 documentType: 'nota_fiscal',
 documentDescription: '',
 fileUrl: '',
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
export function SupportTicketAttachmentsPage() {
 const queryClient = useQueryClient();
 const { data: items = [], isLoading } = useQuery<SupportTicketAttachmentResponse[]>({
 queryKey: supportTicketAttachmentQueryKey,
 queryFn: fetchSupportTicketAttachmentItems,
 });
 const {
 register,
 handleSubmit,
 reset,
 formState: { errors, isSubmitting },
 } = useForm<SupportTicketAttachmentFormValues>({
 resolver: zodResolver(supportTicketAttachmentFormSchema),
 defaultValues: initialForm,
 });
 const mutation = useMutation({
 mutationFn: (input: SupportTicketAttachmentRequest) => createSupportTicketAttachment(input),
 onSuccess: (created) => {
 queryClient.setQueryData<SupportTicketAttachmentResponse[]>(supportTicketAttachmentQueryKey, (current = []) => [created, ...current]);
 reset(initialForm);
 },
 });
 return (
 <FeatureWorkbench
 accent="teal"
 productMode="evidence-workbench"
 uiIntent="register"
 layoutVariant="evidence-split"
 pageArchetype=""
 fallbackPattern=""
 patternHints={[]}
 sections={["hero","queue","form","records"]}
 componentMap={{"recordsLead":"evidenceRail"}}
 eyebrow="Anexos do Chamado"
 title="Anexe evidencias ao chamado"
 description="Associe imagens, arquivos e documentos ao chamado para facilitar o entendimento do problema pelo suporte."
 highlights={["Fluxo desenhado para reduzir duvidas e acelerar a conclusao.","Leitura clara do que precisa ser feito agora.","Documentos relevantes aparecem com tipo, contexto e momento do envio."]}
 formTitle="Concluir operacao"
 formDescription="Preencha as informacoes essenciais para concluir esta etapa com seguranca e contexto."
 form={
 <form onSubmit={handleSubmit((values) => mutation.mutateAsync({
 documentType: values.documentType,
 documentDescription: values.documentDescription,
 fileUrl: values.fileUrl,
 }))} style={{ display: 'grid', gap: 18 }}>
 <FieldGroup label="Tipo de documento" hint="Classifique o anexo para facilitar a triagem do chamado.">
 <select
 {...register('documentType')}
 style={inputStyle()}
 >
 <option value="nota_fiscal">Nota fiscal</option>
 <option value="comprovante">Comprovante</option>
 <option value="recibo">Recibo</option>
 <option value="contrato">Contrato</option>
 <option value="outro">Outro</option>
 </select>
 {errors.documentType ? <small style={{ color: '#b91c1c' }}>{errors.documentType.message}</small> : null}
 </FieldGroup>
 <FieldGroup label="Descricao do anexo" hint="Explique rapidamente por que este documento ajuda no atendimento.">
 <textarea
 {...register('documentDescription')}
 placeholder="Descreva o conteudo do documento e o contexto do chamado"
 style={inputStyle({ minHeight: 132, resize: 'vertical' })}
 />
 {errors.documentDescription ? <small style={{ color: '#b91c1c' }}>{errors.documentDescription.message}</small> : null}
 </FieldGroup>
 <FieldGroup label="Arquivo ou link do comprovante" hint="Informe a URL do arquivo salvo para que o time de suporte consiga acessar o documento.">
 <input
 {...register('fileUrl')}
 type="url"
 placeholder="https://arquivos.empresa.com/documentos/comprovante.pdf"
 style={inputStyle()}
 />
 {errors.fileUrl ? <small style={{ color: '#b91c1c' }}>{errors.fileUrl.message}</small> : null}
 </FieldGroup>
 <PrimaryButton type="submit" accent="teal">
 {isSubmitting || mutation.isPending ? 'Processando...' : 'Anexar Evidencia'}
 </PrimaryButton>
 {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>"Evidencia anexada com sucesso."</p> : null}
 {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
 </form>
 }
 listTitle="Contexto do envio"
 listDescription="Nenhum documento anexado ainda. Adicione o primeiro comprovante para acelerar a analise."
 listMeta={isLoading ? 'Atualizando' : items.length ? `${items.length} registro(s)` : 'Nenhum registro'}
 >
 <div style={{ display: 'grid', gap: 10 }}>
 {isLoading ? (
 <div style={{ padding: '18px 16px', borderRadius: 16, background: '#fffaf0', border: '1px dashed #f59e0b' }}>
 <p style={{ margin: 0, color: '#92400e', lineHeight: 1.7 }}>Preparando trilha de evidencias para consulta do caso...</p>
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
 gridTemplateColumns: '1.3fr 0.8fr 0.9fr',
 gap: 12,
 alignItems: 'center',
 }}
 >
 <div style={{ display: 'grid', gap: 4 }}>
 <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{String(item.documentType || item.id)}</strong>
 <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.documentDescription || 'Evidencia pronta para consulta')}</span>
 </div>
 <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#fff7ed', color: '#c2410c', fontSize: 12, fontWeight: 700 }}>
 {humanizeStatus(String(item.status || 'active'))}
 </span>
 <span style={{ color: '#64748b', fontSize: 13 }}>{formatCreatedAt(String(item.createdAt || ''))}</span>
 </article>
 ))
 ) : (
 <div style={{ padding: 28, borderRadius: 16, background: '#fff7ed', border: '1px dashed #fdba74', textAlign: 'center' }}>
 <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#ffedd5', color: '#c2410c', display: 'grid', placeItems: 'center', fontSize: 24 }}>+</div>
 <p style={{ margin: 0, color: '#7c2d12', lineHeight: 1.7 }}>"Nenhum documento anexado ainda. Adicione o primeiro comprovante para acelerar a analise."</p>
 </div>
 )}
 </div>
 </FeatureWorkbench>
 );
}