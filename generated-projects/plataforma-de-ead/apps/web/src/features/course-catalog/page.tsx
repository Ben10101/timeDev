import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CourseCatalogRequest, CourseCatalogResponse } from '../../../../../packages/shared/src/contracts/course-catalog.ts';
import { createCourseCatalog, fetchCourseCatalogItems } from './service';

const initialForm: CourseCatalogRequest = {
  courseName: '',
  description: '',
  category: '',
  price: '',
};

const pageShellStyle = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top left, rgba(15, 118, 110, 0.12), transparent 28%), linear-gradient(180deg, #f8fafc 0%, #eef4f7 100%)',
  padding: '40px 24px 72px',
};

const pageGridStyle = {
  maxWidth: 1180,
  margin: '0 auto',
  display: 'grid',
  gap: 32,
  gridTemplateColumns: 'minmax(0, 1.08fr) minmax(340px, 0.92fr)',
};

const heroCardStyle = {
  display: 'grid',
  gap: 24,
  alignContent: 'start',
  padding: 36,
  borderRadius: 32,
  background: 'linear-gradient(145deg, #0f172a 0%, #134e4a 100%)',
  color: '#f8fafc',
  boxShadow: '0 32px 90px rgba(15, 23, 42, 0.22)',
};

const panelStyle = {
  padding: 28,
  borderRadius: 28,
  background: 'rgba(255, 255, 255, 0.94)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  boxShadow: '0 22px 60px rgba(15, 23, 42, 0.08)',
  backdropFilter: 'blur(12px)',
};

const inputStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: 16,
  border: '1px solid #cbd5e1',
  background: '#f8fafc',
  color: '#0f172a',
  fontSize: 15,
  boxSizing: 'border-box' as const,
};

const labelStyle = {
  display: 'grid',
  gap: 8,
};

const hintStyle = {
  color: '#64748b',
  fontSize: 13,
  lineHeight: 1.5,
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
    <section style={pageShellStyle}>
      <div style={pageGridStyle}>
        <div style={heroCardStyle}>
          <span
            style={{
              display: 'inline-flex',
              width: 'fit-content',
              padding: '8px 14px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.16)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            Catalogo de cursos
          </span>

          <div style={{ display: 'grid', gap: 14 }}>
            <h1 style={{ margin: 0, fontSize: 52, lineHeight: 1, letterSpacing: '-0.04em' }}>
              Lance um curso com clareza comercial e estrutura forte.
            </h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.7, color: 'rgba(248, 250, 252, 0.82)', maxWidth: 620 }}>
              Cadastre o curso com posicionamento claro, categoria bem definida e preco pronto para
              venda. A tela ja te ajuda a montar um ponto de partida consistente para o restante da
              operacao.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {[
              ['Curso publicado', `${items.length}`],
              ['Ticket inicial', form.price || 'R$ 0'],
              ['Categoria ativa', form.category || 'Nao definida'],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: 18,
                  borderRadius: 22,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(248, 250, 252, 0.66)' }}>
                  {label}
                </div>
                <strong style={{ display: 'block', marginTop: 10, fontSize: 28 }}>{value}</strong>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {[
              'Destaque a transformacao principal que o aluno vai viver.',
              'Use categorias que facilitem busca, vendas e navegacao.',
              'Defina um preco inicial realista para validar o mercado.',
            ].map((item) => (
              <div
                key={item}
                style={{
                  padding: '15px 18px',
                  borderRadius: 18,
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(248, 250, 252, 0.88)',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          <div style={panelStyle}>
            <div style={{ display: 'grid', gap: 6, marginBottom: 22 }}>
              <h2 style={{ margin: 0, fontSize: 28, color: '#0f172a' }}>Novo curso</h2>
              <p style={{ margin: 0, color: '#64748b', lineHeight: 1.6 }}>
                Preencha os dados principais para abrir uma nova oferta na plataforma.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
              <label style={labelStyle}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Nome do curso</span>
                <input
                  type="text"
                  value={form.courseName}
                  placeholder="Ex.: Dominando React do zero"
                  onChange={(event) => setForm((current) => ({ ...current, courseName: event.target.value }))}
                  style={inputStyle}
                />
                <small style={hintStyle}>Use um titulo facil de lembrar e forte para a vitrine.</small>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Descricao</span>
                <textarea
                  value={form.description}
                  placeholder="Explique o que o aluno vai aprender e o resultado esperado."
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  style={{ ...inputStyle, minHeight: 132, resize: 'vertical' as const }}
                />
                <small style={hintStyle}>Mostre promessa, publico ideal e ganhos praticos.</small>
              </label>

              <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <label style={labelStyle}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>Categoria</span>
                  <input
                    type="text"
                    value={form.category}
                    placeholder="Ex.: Desenvolvimento Web"
                    onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                    style={inputStyle}
                  />
                  <small style={hintStyle}>Ajuda o aluno a encontrar o curso com rapidez.</small>
                </label>

                <label style={labelStyle}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>Preco</span>
                  <input
                    type="number"
                    value={form.price}
                    placeholder="197.00"
                    onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                    style={inputStyle}
                  />
                  <small style={hintStyle}>Use um valor inicial para validar adesao e posicionamento.</small>
                </label>
              </div>

              <button
                type="submit"
                style={{
                  padding: '15px 18px',
                  borderRadius: 16,
                  border: 'none',
                  background: 'linear-gradient(135deg, #0f766e, #14b8a6)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  boxShadow: '0 18px 36px rgba(20, 184, 166, 0.28)',
                }}
              >
                Criar curso
              </button>
            </form>

            {feedback ? <p style={{ marginTop: 16, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
            {errorMessage ? <p style={{ marginTop: 16, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
          </div>

          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Cursos criados</h3>
                <p style={{ margin: '6px 0 0', color: '#64748b' }}>Acompanhe os itens ja disponiveis na plataforma.</p>
              </div>
              <span
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: '#ecfeff',
                  color: '#155e75',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {items.length} registro(s)
              </span>
            </div>

            {items.length ? (
              <div style={{ display: 'grid', gap: 12 }}>
                {items.map((item) => (
                  <article
                    key={item.id}
                    style={{
                      padding: 18,
                      borderRadius: 20,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>
                      {String(item.courseName || item.id)}
                    </strong>
                    <span style={{ display: 'block', marginTop: 6, color: '#64748b' }}>
                      {String(item.category || 'Sem categoria definida')}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: '#64748b' }}>Nenhum curso cadastrado ainda.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
