import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { LessonMaterialRequest, LessonMaterialResponse } from '../../../../../packages/shared/src/contracts/lesson-materials.ts'
import { FeaturePage, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx'
import { createLessonMaterial, fetchLessonMaterialItems } from './service'

const initialForm: LessonMaterialRequest = {
  materialTitle: '',
  fileType: 'pdf',
  fileUrl: '',
}

export function LessonMaterialsPage() {
  const [items, setItems] = useState<LessonMaterialResponse[]>([])
  const [form, setForm] = useState<LessonMaterialRequest>(initialForm)
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    fetchLessonMaterialItems().then(setItems).catch(() => setItems([]))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')
    setErrorMessage('')

    try {
      const created = await createLessonMaterial(form)
      setItems((current) => [created, ...current])
      setForm(initialForm)
      setFeedback('Material enviado com sucesso.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.')
    }
  }

  return (
    <FeaturePage
      accent="amber"
      layout="crud"
      eyebrow="Biblioteca de materiais"
      title="Entregue materiais complementares que reforcam cada aula sem complicar a operacao."
      description="Centralize PDFs, planilhas, checklists e links de apoio para tornar a experiencia de estudo mais completa."
      metrics={[
        { label: 'Materiais enviados', value: String(items.length) },
        { label: 'Formato atual', value: form.fileType || 'pdf' },
        { label: 'Entrega pronta', value: form.fileUrl ? 'Sim' : 'Pendente' },
      ]}
      highlights={[
        'Agrupe materiais por finalidade: apoio, pratica ou aprofundamento.',
        'Use titulos claros para facilitar busca e download pelo aluno.',
        'Prefira links estaveis para evitar materiais quebrados no curso.',
      ]}
      formTitle="Novo material"
      formDescription="Cadastre um recurso complementar e deixe a entrega pronta para consulta."
      form={
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Titulo do material" hint="Diga claramente o que o aluno vai encontrar ao abrir o material.">
            <input
              type="text"
              value={form.materialTitle}
              placeholder="Ex.: Checklist da aula"
              onChange={(event) => setForm((current) => ({ ...current, materialTitle: event.target.value }))}
              style={inputStyle()}
            />
          </FieldGroup>

          <FieldGroup label="Tipo de arquivo" hint="Escolha o formato que melhor representa o recurso enviado.">
            <select
              value={form.fileType}
              onChange={(event) => setForm((current) => ({ ...current, fileType: event.target.value }))}
              style={inputStyle()}
            >
              <option value="pdf">PDF</option>
              <option value="planilha">Planilha</option>
              <option value="zip">ZIP</option>
              <option value="link">Link</option>
            </select>
          </FieldGroup>

          <FieldGroup label="URL do arquivo" hint="Use um link estavel para liberar download ou acesso imediato.">
            <input
              type="url"
              value={form.fileUrl}
              placeholder="https://cdn.exemplo.com/material.pdf"
              onChange={(event) => setForm((current) => ({ ...current, fileUrl: event.target.value }))}
              style={inputStyle()}
            />
          </FieldGroup>

          <PrimaryButton type="submit" accent="amber">
            Enviar material
          </PrimaryButton>

          {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
          {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
        </form>
      }
      listTitle="Biblioteca cadastrada"
      listDescription="Consulte os materiais complementares ja enviados."
      listMeta={`${items.length} item(ns)`}
    >
      {items.length ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <article key={item.id} style={{ padding: 18, borderRadius: 20, background: '#fffaf0', border: '1px solid #fde68a' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>{String(item.materialTitle || item.id)}</strong>
              <span style={{ display: 'block', marginTop: 6, color: '#92400e' }}>Tipo: {String(item.fileType || '-')}</span>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Nenhum material complementar cadastrado ainda.</p>
      )}
    </FeaturePage>
  )
}
