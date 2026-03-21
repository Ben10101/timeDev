import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CourseLessonRequest, CourseLessonResponse } from '../../../../../packages/shared/src/contracts/course-lessons.ts';
import { FeaturePage, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { createCourseLesson, fetchCourseLessonItems } from './service';

const initialForm: CourseLessonRequest = {
  lessonTitle: '',
  mediaType: 'video',
  moduleReference: '',
};

export function CourseLessonsPage() {
  const [items, setItems] = useState<CourseLessonResponse[]>([]);
  const [form, setForm] = useState<CourseLessonRequest>(initialForm);
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchCourseLessonItems().then(setItems).catch(() => setItems([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');
    setErrorMessage('');

    try {
      const created = await createCourseLesson({
      lessonTitle: form.lessonTitle,
      mediaType: form.mediaType,
      moduleReference: form.moduleReference,
      });
      setItems((current) => [created, ...current]);
      setForm(initialForm);
      setFeedback('Aula adicionada com sucesso.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.');
    }
  }

  return (
    <FeaturePage
      accent="violet"
      layout="split"
      eyebrow="Novo Conteúdo"
      title="Cadastre uma nova aula"
      description="Ofereça conteúdo diversificado para seus alunos."
      metrics={[
        { label: 'Campos essenciais', value: '3' },
        { label: 'Registros atuais', value: String(items.length) },
        { label: 'Acao principal', value: 'Cadastre uma nova aula' },
      ]}
      highlights={["Associe aulas aos módulos","Escolha vídeo, áudio ou PDF"]}
      formTitle="Detalhes da Aula"
      formDescription="Preencha as informações para adicionar a aula ao módulo."
      form={
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Titulo da aula" hint="Informe o nome da aula exibido para o aluno.">
            <input
              type="text"
              value={form.lessonTitle}
              onChange={(event) => setForm((current) => ({ ...current, lessonTitle: event.target.value }))}
              placeholder="Ex.: Instalando o ambiente"
              style={inputStyle()}
            />
          </FieldGroup>
          <FieldGroup label="Tipo de midia" hint="Defina se a aula sera em video, audio ou PDF.">
            <input
              type="text"
              value={form.mediaType}
              onChange={(event) => setForm((current) => ({ ...current, mediaType: event.target.value }))}
              placeholder="video | audio | pdf"
              style={inputStyle()}
            />
          </FieldGroup>
          <FieldGroup label="Modulo" hint="Associe a aula ao modulo correto do curso.">
            <input
              type="text"
              value={form.moduleReference}
              onChange={(event) => setForm((current) => ({ ...current, moduleReference: event.target.value }))}
              placeholder="Ex.: Fundamentos do curso"
              style={inputStyle()}
            />
          </FieldGroup>
          <PrimaryButton type="submit" accent="violet">
            Adicionar Aula
          </PrimaryButton>

          {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
          {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
        </form>
      }
      listTitle="Aulas cadastradas"
      listDescription="Acompanhe os registros criados nesta area."
      listMeta={`${items.length} registro(s)`}
    >
      {items.length ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <article key={item.id} style={{ padding: 18, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>{String(item.lessonTitle || item.id)}</strong>
              <span style={{ display: 'block', marginTop: 6, color: '#64748b' }}>{String(item.mediaType || item.status || 'active')}</span>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Nenhuma aula adicionada ainda</p>
      )}
    </FeaturePage>
  );
}
