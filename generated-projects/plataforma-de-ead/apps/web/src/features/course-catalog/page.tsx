import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { CourseCatalogRequest, CourseCatalogResponse } from '../../../../../packages/shared/src/contracts/course-catalog.ts'
import { FeaturePage, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx'
import { createCourseCatalog, fetchCourseCatalogItems } from './service'

const initialForm: CourseCatalogRequest = {
  courseName: '',
  description: '',
  category: '',
  price: '',
}

export function CourseCatalogPage() {
  const [items, setItems] = useState<CourseCatalogResponse[]>([])
  const [form, setForm] = useState<CourseCatalogRequest>(initialForm)
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    fetchCourseCatalogItems().then(setItems).catch(() => setItems([]))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')
    setErrorMessage('')

    try {
      const created = await createCourseCatalog(form)
      setItems((current) => [created, ...current])
      setForm(initialForm)
      setFeedback('Curso criado com sucesso.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.')
    }
  }

  return (
    <FeaturePage
      accent="teal"
      layout="crud"
      eyebrow="Catalogo de cursos"
      title="Lance um curso com clareza comercial e estrutura forte."
      description="Cadastre o curso com posicionamento claro, categoria bem definida e preco pronto para venda."
      metrics={[
        { label: 'Cursos criados', value: String(items.length) },
        { label: 'Ticket inicial', value: form.price || 'R$ 0' },
        { label: 'Categoria ativa', value: form.category || 'Nao definida' },
      ]}
      highlights={[
        'Destaque a transformacao principal que o aluno vai viver.',
        'Use categorias que facilitem busca, vendas e navegacao.',
        'Defina um preco inicial realista para validar o mercado.',
      ]}
      formTitle="Novo curso"
      formDescription="Preencha os dados principais para abrir uma nova oferta na plataforma."
      form={
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Nome do curso" hint="Use um titulo facil de lembrar e forte para a vitrine.">
            <input
              type="text"
              value={form.courseName}
              placeholder="Ex.: Dominando React do zero"
              onChange={(event) => setForm((current) => ({ ...current, courseName: event.target.value }))}
              style={inputStyle()}
            />
          </FieldGroup>

          <FieldGroup label="Descricao" hint="Mostre promessa, publico ideal e ganhos praticos.">
            <textarea
              value={form.description}
              placeholder="Explique o que o aluno vai aprender e o resultado esperado."
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              style={inputStyle({ minHeight: 132, resize: 'vertical' })}
            />
          </FieldGroup>

          <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <FieldGroup label="Categoria" hint="Ajuda o aluno a encontrar o curso com rapidez.">
              <input
                type="text"
                value={form.category}
                placeholder="Ex.: Desenvolvimento Web"
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                style={inputStyle()}
              />
            </FieldGroup>

            <FieldGroup label="Preco" hint="Use um valor inicial para validar adesao e posicionamento.">
              <input
                type="number"
                value={form.price}
                placeholder="197.00"
                onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                style={inputStyle()}
              />
            </FieldGroup>
          </div>

          <PrimaryButton type="submit" accent="teal">
            Criar curso
          </PrimaryButton>

          {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
          {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
        </form>
      }
      listTitle="Cursos criados"
      listDescription="Acompanhe os itens ja disponiveis na plataforma."
      listMeta={`${items.length} registro(s)`}
    >
      {items.length ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <article key={item.id} style={{ padding: 18, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>{String(item.courseName || item.id)}</strong>
              <span style={{ display: 'block', marginTop: 6, color: '#64748b' }}>{String(item.category || 'Sem categoria definida')}</span>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Nenhum curso cadastrado ainda.</p>
      )}
    </FeaturePage>
  )
}
