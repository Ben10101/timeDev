import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { LessonMaterialRequest, LessonMaterialResponse } from '../../../../../packages/shared/src/contracts/lesson-materials.ts';
import { FeaturePage, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { createLessonMaterial, fetchLessonMaterialItems } from './service';

const initialForm: LessonMaterialRequest = {
  materialTitle: '',
  fileType: 'pdf',
  fileUrl: '',
};

export function LessonMaterialsPage() {
  const [items, setItems] = useState<LessonMaterialResponse[]>([]);
  const [form, setForm] = useState<LessonMaterialRequest>(initialForm);
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchLessonMaterialItems().then(setItems).catch(() => setItems([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');
    setErrorMessage('');

    try {
      const created = await createLessonMaterial({
      materialTitle: form.materialTitle,
      fileType: form.fileType,
      fileUrl: form.fileUrl,
      });
      setItems((current) => [created, ...current]);
      setForm(initialForm);
      setFeedback('Material enviado com sucesso.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.');
    }
  }

  return (
    <FeaturePage
      accent="teal"
      layout="split"
      eyebrow="Materiais"
      title="Envie materiais complementares"
      description="Anexe PDFs, planilhas e outros arquivos para enriquecer cada aula."
      metrics={[
        { label: 'Campos essenciais', value: '3' },
        { label: 'Registros atuais', value: String(items.length) },
        { label: 'Acao principal', value: 'Enviar Material' },
      ]}
      highlights={["Validacao automatica dos campos antes do envio.","Feedback imediato em caso de sucesso ou erro."]}
      formTitle="Preencha os dados"
      formDescription="Informe os dados necessarios para continuar."
      form={
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Titulo do material" hint="Identifique o material complementar para o aluno.">
            <input
              type="text"
              value={form.materialTitle}
              onChange={(event) => setForm((current) => ({ ...current, materialTitle: event.target.value }))}
              placeholder="Ex.: Checklist da aula"
              style={inputStyle()}
            />
          </FieldGroup>
          <FieldGroup label="Tipo de arquivo" hint="Informe o formato do material enviado.">
            <input
              type="text"
              value={form.fileType}
              onChange={(event) => setForm((current) => ({ ...current, fileType: event.target.value }))}
              placeholder="pdf | planilha | zip"
              style={inputStyle()}
            />
          </FieldGroup>
          <FieldGroup label="URL do arquivo" hint="Use a URL do arquivo armazenado para liberar o download.">
            <input
              type="url"
              value={form.fileUrl}
              onChange={(event) => setForm((current) => ({ ...current, fileUrl: event.target.value }))}
              placeholder="https://cdn.exemplo.com/material.pdf"
              style={inputStyle()}
            />
          </FieldGroup>
          <PrimaryButton type="submit" accent="teal">
            Enviar Material
          </PrimaryButton>

          {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
          {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
        </form>
      }
      listTitle="Visao geral"
      listDescription="Acompanhe os registros criados nesta area."
      listMeta={`${items.length} registro(s)`}
    >
      {items.length ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <article key={item.id} style={{ padding: 18, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>{String(item.materialTitle || item.id)}</strong>
              <span style={{ display: 'block', marginTop: 6, color: '#64748b' }}>{String(item.fileType || item.status || 'active')}</span>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Nenhum dado exibido ainda.</p>
      )}
    </FeaturePage>
  );
}
