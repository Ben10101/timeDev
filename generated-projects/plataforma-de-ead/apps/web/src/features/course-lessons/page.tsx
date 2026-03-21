import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { CourseLessonRequest, CourseLessonResponse } from '../../../../../packages/shared/src/contracts/course-lessons.ts'
import { FeaturePage, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx'
import { createCourseLesson, fetchCourseLessonItems } from './service'

const initialForm: CourseLessonRequest = {
  lessonTitle: '',
  mediaType: 'video',
  moduleReference: '',
}

export function CourseLessonsPage() {
  const [items, setItems] = useState<CourseLessonResponse[]>([])
  const [form, setForm] = useState<CourseLessonRequest>(initialForm)
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    fetchCourseLessonItems().then(setItems).catch(() => setItems([]))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')
    setErrorMessage('')

    try {
      const created = await createCourseLesson(form)
      setItems((current) => [created, ...current])
      setForm(initialForm)
      setFeedback('Aula adicionada com sucesso.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.')
    }
  }

  return (
    <FeaturePage
      accent="violet"
      layout="wizard"
      eyebrow="Aulas do curso"
      title="Monte uma experiencia de aula mais rica, modular e facil de consumir."
      description="Cadastre aulas com titulo claro, tipo de midia bem definido e relacao direta com o modulo certo."
      metrics={[
        { label: 'Aulas criadas', value: String(items.length) },
        { label: 'Midia atual', value: form.mediaType || 'video' },
        { label: 'Modulo alvo', value: form.moduleReference || 'Nao definido' },
      ]}
      highlights={[
        'Diferencie aulas introdutorias, praticas e materiais de apoio.',
        'Vincule cada aula ao modulo certo para evitar confusao de contexto.',
        'Escolha a midia pensando no formato ideal para consumo do aluno.',
      ]}
      formTitle="Nova aula"
      formDescription="Registre uma aula e conecte esse conteudo ao modulo certo."
      form={
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Titulo da aula" hint="Escolha um titulo simples e facil de localizar na trilha.">
            <input
              type="text"
              value={form.lessonTitle}
              placeholder="Ex.: Instalando o ambiente"
              onChange={(event) => setForm((current) => ({ ...current, lessonTitle: event.target.value }))}
              style={inputStyle()}
            />
          </FieldGroup>

          <FieldGroup label="Tipo de midia" hint="Defina o formato principal de consumo da aula.">
            <select
              value={form.mediaType}
              onChange={(event) => setForm((current) => ({ ...current, mediaType: event.target.value }))}
              style={inputStyle()}
            >
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="pdf">PDF</option>
            </select>
          </FieldGroup>

          <FieldGroup label="Modulo relacionado" hint="Associe a aula ao bloco correto para manter a progressao.">
            <input
              type="text"
              value={form.moduleReference}
              placeholder="Ex.: Fundamentos do curso"
              onChange={(event) => setForm((current) => ({ ...current, moduleReference: event.target.value }))}
              style={inputStyle()}
            />
          </FieldGroup>

          <PrimaryButton type="submit" accent="violet">
            Adicionar aula
          </PrimaryButton>

          {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
          {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
        </form>
      }
      listTitle="Trilha de aulas"
      listDescription="Veja as aulas ja cadastradas e prontas para compor o curso."
      listMeta={`${items.length} aula(s)`}
    >
      {items.length ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <article key={item.id} style={{ padding: 18, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>{String(item.lessonTitle || item.id)}</strong>
              <span style={{ display: 'block', marginTop: 6, color: '#64748b' }}>Midia: {String(item.mediaType || '-')}</span>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Nenhuma aula adicionada ainda.</p>
      )}
    </FeaturePage>
  )
}
