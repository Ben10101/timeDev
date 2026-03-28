import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { SupportTicketAttachmentRequest, SupportTicketAttachmentResponse } from '../../../../../packages/shared/src/contracts/support-ticket-attachments.ts';
import { FeatureWorkbench, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { createSupportTicketAttachment, fetchSupportTicketAttachmentItems } from './service';
const initialForm: SupportTicketAttachmentRequest = {
 documentType: 'nota_fiscal',
 documentDescription: '',
 fileUrl: '',
};
export function SupportTicketAttachmentsPage() {
 const [items, setItems] = useState<SupportTicketAttachmentResponse[]>([]);
 const [form, setForm] = useState<SupportTicketAttachmentRequest>(initialForm);
 const [feedback, setFeedback] = useState('');
 const [errorMessage, setErrorMessage] = useState('');
 const [isLoading, setIsLoading] = useState(true);
 const [isSubmitting, setIsSubmitting] = useState(false);
 useEffect(() => {
 fetchSupportTicketAttachmentItems()
 .then(setItems)
 .catch(() => setItems([]))
 .finally(() => setIsLoading(false));
 }, []);
 async function handleSubmit(event: FormEvent<HTMLFormElement>) {
 event.preventDefault();
 setFeedback('');
 setErrorMessage('');
 setIsSubmitting(true);
 try {
 const created = await createSupportTicketAttachment({
 documentType: form.documentType,
 documentDescription: form.documentDescription,
 fileUrl: form.fileUrl,
 });
 setItems((current) => [created, ...current]);
 setForm(initialForm);
 setFeedback('Documento anexado com sucesso.');
 } catch (error) {
 setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.');
 } finally {
 setIsSubmitting(false);
 }
 }
 return (
 <FeatureWorkbench
 accent="amber"
 productMode="evidence-workbench"
 eyebrow="Bancada de Evidencias"
 title="Contexto do Atendimento"
 description="Acompanhe os documentos ja anexados e adicione novas provas para garantir uma triagem precisa."
 metrics={[
 { label: 'Triagem', value: isLoading ? 'Sincronizando' : 'Ativa' },
 { label: 'Evidencias', value: isLoading ? '...' : String(items.length || 0) },
 { label: 'Prioridade', value: 'Alta' },
 ]}
 highlights={["Triagem acelerada com prova documental","Visibilidade imediata para o time de suporte"]}
 formTitle="Novo Anexo"
 formDescription="Preencha os dados do documento para vincular ao chamado atual."
 form={
 <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
 <FieldGroup label="Tipo de documento" hint="Classifique o anexo para facilitar a triagem do chamado.">
 <select
 value={form.documentType}
 onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))}
 style={inputStyle()}
 >
 <option value="nota_fiscal">Nota fiscal</option>
 <option value="comprovante">Comprovante</option>
 <option value="recibo">Recibo</option>
 <option value="contrato">Contrato</option>
 <option value="outro">Outro</option>
 </select>
 </FieldGroup>
 <FieldGroup label="Descricao do anexo" hint="Explique rapidamente por que este documento ajuda no atendimento.">
 <textarea
 value={form.documentDescription}
 onChange={(event) => setForm((current) => ({ ...current, documentDescription: event.target.value }))}
 placeholder="Descreva o conteudo do documento e o contexto do chamado"
 style={inputStyle({ minHeight: 132, resize: 'vertical' })}
 />
 </FieldGroup>
 <FieldGroup label="Arquivo ou link do comprovante" hint="Informe a URL do arquivo salvo para que o time de suporte consiga acessar o documento.">
 <input
 type="url"
 value={form.fileUrl}
 onChange={(event) => setForm((current) => ({ ...current, fileUrl: event.target.value }))}
 placeholder="https://arquivos.empresa.com/documentos/comprovante.pdf"
 style={inputStyle()}
 />
 </FieldGroup>
 <PrimaryButton type="submit" accent="amber">
 {isSubmitting ? 'Processando...' : 'Anexar Documento'}
 </PrimaryButton>
 {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
 {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
 </form>
 }
 listTitle="Evidencias do Caso"
 listDescription="Nenhum documento anexado ainda. Adicione o primeiro acima."
 listMeta={isLoading ? 'Sincronizando' : items.length ? `${items.length} evidencia(s) vinculada(s)` : 'Sem evidencias'}
 >
 {isLoading ? (
 <div style={{ display: 'grid', gap: 10 }}>
 {[0, 1].map((placeholder) => (
 <div
 key={placeholder}
 style={{
 padding: '18px 16px',
 borderRadius: 14,
 background: '#f8fafc',
 border: '1px solid #e2e8f0',
 minHeight: 74,
 }}
 />
 ))}
 </div>
 ) : items.length ? (
 <div style={{ display: 'grid', gap: 10 }}>
 {items.map((item) => (
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
 <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.documentDescription || 'Item pronto para consulta')}</span>
 </div>
 <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#ecfeff', color: '#115e59', fontSize: 12, fontWeight: 700 }}>
 {String(item.status || 'active')}
 </span>
 <span style={{ color: '#64748b', fontSize: 13 }}>{String(item.createdAt || 'Agora')}</span>
 </article>
 ))}
 </div>
 ) : (
 <div style={{ padding: 28, borderRadius: 16, background: '#f8fafc', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
 <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#e2e8f0', color: '#475569', display: 'grid', placeItems: 'center', fontSize: 24 }}>O</div>
 <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>Nenhum documento anexado ainda. Adicione o primeiro acima.</p>
 </div>
 )}
 </FeatureWorkbench>
 );
}