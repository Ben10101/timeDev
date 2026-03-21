import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CourseCatalogRequest, CourseCatalogResponse } from '../../../../../packages/shared/src/contracts/course-catalog.ts';
import { FeaturePage, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { createCourseCatalog, fetchCourseCatalogItems } from './service';

const initialForm: CourseCatalogRequest = {
  courseName: '',
  description: '',
  category: '',
  price: '',
};

export function CourseCatalogPage() {
  const [items, setItems] = useState<CourseCatalogResponse[]>([]);
  const [form, setForm] = useState<CourseCatalogRequest>(initialForm);
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchCourseCatalogItems().then(setItems).catch(() => setItems([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');
    setErrorMessage('');

    try {
      const created = await createCourseCatalog({
      courseName: form.courseName,
      description: form.description,
      category: form.category,
      price: form.price,
      });
      setItems((current) => [created, ...current]);
      setForm(initialForm);
      setFeedback('Curso criado com sucesso.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.');
    }
  }

  return (
    <FeaturePage
      accent="teal"
      layout="split"
      eyebrow="Novo Curso"
      title="Disponibilize seu curso"
      description="Defina nome, descrição, categoria e preço para começar a vender."
      metrics={[
        { label: 'Campos essenciais', value: '4' },
        { label: 'Registros atuais', value: String(items.length) },
        { label: 'Acao principal', value: 'Criar Curso' },
      ]}
      highlights={["Nome claro para identificar","Descrição objetiva e atrativa"]}
      formTitle="Detalhes do Curso"
      formDescription="Preencha as informações abaixo para criar seu curso."
      form={
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Nome do curso" hint="Informe um nome claro para identificar o curso.">
            <input
              type="text"
              value={form.courseName}
              onChange={(event) => setForm((current) => ({ ...current, courseName: event.target.value }))}
              placeholder="Ex.: Dominando React do zero"
              style={inputStyle()}
            />
          </FieldGroup>
          <FieldGroup label="Descricao" hint="Descreva a proposta e os beneficios do curso.">
            <input
              type="text"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Explique o que o aluno vai aprender."
              style={inputStyle()}
            />
          </FieldGroup>
          <FieldGroup label="Categoria" hint="Organize o curso em uma categoria comercial.">
            <input
              type="text"
              value={form.category}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              placeholder="Ex.: Desenvolvimento Web"
              style={inputStyle()}
            />
          </FieldGroup>
          <FieldGroup label="Preco" hint="Defina o valor de venda do curso.">
            <input
              type="number"
              value={form.price}
              onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
              placeholder="Ex.: 197.00"
              style={inputStyle()}
            />
          </FieldGroup>
          <PrimaryButton type="submit" accent="teal">
            Criar Curso
          </PrimaryButton>

          {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
          {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
        </form>
      }
      listTitle="Meus Cursos"
      listDescription="Acompanhe os registros criados nesta area."
      listMeta={`${items.length} registro(s)`}
    >
      {items.length ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <article key={item.id} style={{ padding: 18, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>{String(item.courseName || item.id)}</strong>
              <span style={{ display: 'block', marginTop: 6, color: '#64748b' }}>{String(item.description || item.status || 'active')}</span>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Nenhum curso cadastrado ainda.</p>
      )}
    </FeaturePage>
  );
}
