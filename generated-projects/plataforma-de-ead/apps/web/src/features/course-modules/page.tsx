import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { CourseModuleRequest, CourseModuleResponse } from '../../../../../packages/shared/src/contracts/course-modules.ts'
import { FeaturePage, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx'
import { createCourseModule, fetchCourseModuleItems } from './service'

const initialForm: CourseModuleRequest = {
  moduleName: '',
  moduleDescription: '',
  displayOrder: '1',
}

export function CourseModulesPage() {
  const [items, setItems] = useState<CourseModuleResponse[]>([])
  const [form, setForm] = useState<CourseModuleRequest>(initialForm)
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    fetchCourseModuleItems().then(setItems).catch(() => setItems([]))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')
    setErrorMessage('')

    try {
      const created = await createCourseModule(form)
      setItems((current) => [created, ...current])
      setForm(initialForm)
      setFeedback('Modulo adicionado com sucesso.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.')
    }
  }

  return (
    <FeaturePage
      accent="blue"
      layout="wizard"
      eyebrow="Estrutura do curso"
      title="Organize o curso em modulos claros, progressivos e faceis de navegar."
      description="Uma boa estrutura deixa a jornada mais intuitiva, melhora a retencao e facilita a expansao do catalogo."
      metrics={[
        { label: 'Modulos criados', value: String(items.length) },
        { label: 'Proxima ordem', value: form.displayOrder || '1' },
        { label: 'Curso em foco', value: 'Ativo' },
      ]}
      highlights={[
        'Agrupe assuntos que fazem sentido juntos para manter ritmo e contexto.',
        'Defina a ordem de exibicao pensando na evolucao natural do aluno.',
        'Use descricoes curtas para orientar sem poluir a navegacao.',
      ]}
      formTitle="Novo modulo"
      formDescription="Crie secoes logicas para distribuir o conteudo do curso."
      form={
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Nome do modulo" hint="Use um nome objetivo e facil de localizar no indice.">
            <input
              type="text"
              value={form.moduleName}
              placeholder="Ex.: Fundamentos do curso"
              onChange={(event) => setForm((current) => ({ ...current, moduleName: event.target.value }))}
              style={inputStyle()}
            />
          </FieldGroup>

          <FieldGroup label="Descricao do modulo" hint="Ajuda o aluno a entender o que vai aprender antes de entrar.">
            <textarea
              value={form.moduleDescription}
              placeholder="Resumo curto do que sera tratado neste modulo."
              onChange={(event) => setForm((current) => ({ ...current, moduleDescription: event.target.value }))}
              style={inputStyle({ minHeight: 132, resize: 'vertical' })}
            />
          </FieldGroup>

          <FieldGroup label="Ordem de exibicao" hint="Controle a sequencia em que o modulo aparece no curso.">
            <input
              type="number"
              value={form.displayOrder}
              placeholder="1"
              onChange={(event) => setForm((current) => ({ ...current, displayOrder: event.target.value }))}
              style={inputStyle()}
            />
          </FieldGroup>

          <PrimaryButton type="submit" accent="blue">
            Adicionar modulo
          </PrimaryButton>

          {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
          {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
        </form>
      }
      listTitle="Mapa de modulos"
      listDescription="Visualize a espinha dorsal do curso."
      listMeta={`${items.length} modulo(s)`}
    >
      {items.length ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <article key={item.id} style={{ padding: 18, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>{String(item.moduleName || item.id)}</strong>
              <span style={{ display: 'block', marginTop: 6, color: '#64748b' }}>Ordem {String(item.displayOrder || '-')}</span>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Nenhum modulo adicionado ainda.</p>
      )}
    </FeaturePage>
  )
}
