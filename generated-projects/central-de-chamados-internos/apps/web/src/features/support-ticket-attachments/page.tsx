import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { SupportTicketAttachmentRequest, SupportTicketAttachmentResponse } from '../../../../../packages/shared/src/contracts/support-ticket-attachments.ts';
import { FeatureWorkbench, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { supportTicketAttachmentFormSchema, type SupportTicketAttachmentFormValues } from './schema';
import { createSupportTicketAttachment, fetchSupportTicketAttachmentItems, supportTicketAttachmentsQueryKey } from './service';

const initialValues: SupportTicketAttachmentFormValues = {
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
    queryKey: supportTicketAttachmentsQueryKey,
    queryFn: fetchSupportTicketAttachmentItems,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupportTicketAttachmentFormValues>({
    resolver: zodResolver(supportTicketAttachmentFormSchema),
    defaultValues: initialValues,
  });

  const mutation = useMutation({
    mutationFn: (input: SupportTicketAttachmentRequest) => createSupportTicketAttachment(input),
    onSuccess: (created) => {
      queryClient.setQueryData<SupportTicketAttachmentResponse[]>(supportTicketAttachmentsQueryKey, (current = []) => [created, ...current]);
      reset(initialValues);
    },
  });

  return (
    <FeatureWorkbench
      accent="amber"
      productMode="evidence-workbench"
      uiIntent="attach"
      layoutVariant="evidence-split"
      pageArchetype="evidence-workbench"
      fallbackPattern="notion-evidence"
      patternHints={['evidence-context']}
      sections={['hero', 'queue', 'form', 'records']}
      componentMap={{ recordsLead: 'evidenceRail' }}
      eyebrow="Caso #4521"
      title="Anexe o que o suporte precisa ver"
      description="Fotos, prints, PDFs ou links externos que ajudem a entender o problema de forma rapida."
      metrics={[
        { label: 'Fluxo', value: isLoading ? 'Preparando envio' : 'Envio ativo' },
        { label: 'Comprovantes', value: isLoading ? '...' : String(items.length || 0) },
        { label: 'Janela', value: 'Caso atual' },
      ]}
      highlights={['Aceita JPG, PNG, PDF ou link externo', 'Max. 10 MB por arquivo']}
      formTitle="Novo comprovante"
      formDescription="Escolha o tipo, descreva o que mostra e anexe o arquivo ou link."
      form={
        <form onSubmit={handleSubmit((values) => mutation.mutateAsync(values))} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Tipo de documento" hint="Classifique o anexo para facilitar a triagem do chamado.">
            <select {...register('documentType')} style={inputStyle()}>
              <option value="nota_fiscal">Nota fiscal</option>
              <option value="comprovante">Comprovante</option>
              <option value="recibo">Recibo</option>
              <option value="contrato">Contrato</option>
              <option value="outro">Outro</option>
            </select>
            {errors.documentType ? <small style={{ color: '#b91c1c' }}>{errors.documentType.message}</small> : null}
          </FieldGroup>
          <FieldGroup label="Descricao do anexo" hint="Explique rapidamente por que este documento ajuda no atendimento.">
            <textarea {...register('documentDescription')} placeholder="Descreva o conteudo do documento e o contexto do chamado" style={inputStyle({ minHeight: 132, resize: 'vertical' })} />
            {errors.documentDescription ? <small style={{ color: '#b91c1c' }}>{errors.documentDescription.message}</small> : null}
          </FieldGroup>
          <FieldGroup label="Arquivo ou link do comprovante" hint="Informe a URL do arquivo salvo para que o time de suporte consiga acessar o documento.">
            <input {...register('fileUrl')} type="url" placeholder="https://arquivos.empresa.com/documentos/comprovante.pdf" style={inputStyle()} />
            {errors.fileUrl ? <small style={{ color: '#b91c1c' }}>{errors.fileUrl.message}</small> : null}
          </FieldGroup>
          <PrimaryButton type="submit" accent="amber">
            {isSubmitting || mutation.isPending ? 'Enviando...' : 'Anexar ao caso'}
          </PrimaryButton>
          {mutation.isSuccess ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>Evidencia anexada com sucesso.</p> : null}
          {mutation.error ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{mutation.error instanceof Error ? mutation.error.message : 'Falha ao enviar formulario.'}</p> : null}
        </form>
      }
      listTitle="Comprovantes ja enviados"
      listDescription="Veja o que ja entrou no caso e quais evidencias ainda faltam para fechar o diagnostico."
      listMeta={isLoading ? 'Atualizando anexos' : items.length ? `${items.length} comprovante(s)` : 'Nenhum comprovante'}
    >
      {isLoading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {[0, 1].map((placeholder) => (
            <div key={placeholder} style={{ padding: '18px 16px', borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0', minHeight: 74 }} />
          ))}
        </div>
      ) : items.length ? (
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => (
            <article key={item.id} style={{ padding: '14px 16px', borderRadius: 14, background: '#ffffff', border: '1px solid #d9deea', display: 'grid', gridTemplateColumns: '1.3fr 0.8fr 0.9fr', gap: 12, alignItems: 'center' }}>
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ display: 'block', color: '#1f2a44', fontSize: 15 }}>{String(item.documentType || item.id)}</strong>
                <span style={{ display: 'block', color: '#64748b', fontSize: 13 }}>{String(item.documentDescription || 'Contexto pronto para consulta')}</span>
              </div>
              <span style={{ width: 'fit-content', padding: '6px 10px', borderRadius: 999, background: '#ecfeff', color: '#115e59', fontSize: 12, fontWeight: 700 }}>
                {humanizeStatus(String(item.status || 'active'))}
              </span>
              <span style={{ color: '#64748b', fontSize: 13 }}>{formatCreatedAt(String(item.createdAt || ''))}</span>
            </article>
          ))}
        </div>
      ) : (
        <div style={{ padding: 28, borderRadius: 16, background: '#f8fafc', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          <div style={{ width: 58, height: 58, margin: '0 auto 12px', borderRadius: '50%', background: '#e2e8f0', color: '#475569', display: 'grid', placeItems: 'center', fontSize: 24 }}>O</div>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.7 }}>Nenhum documento anexado ainda.</p>
        </div>
      )}
    </FeatureWorkbench>
  );
}
