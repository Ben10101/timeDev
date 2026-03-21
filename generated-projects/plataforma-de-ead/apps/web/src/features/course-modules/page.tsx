import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CourseModuleRequest, CourseModuleResponse } from '../../../../../packages/shared/src/contracts/course-modules.ts';
import { createCourseModule, fetchCourseModuleItems } from './service';

const initialForm: CourseModuleRequest = {
  moduleName: '',
  moduleDescription: '',
  displayOrder: '1',
};

const pageShellStyle = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top left, rgba(29, 78, 216, 0.12), transparent 28%), linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)',
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
  background: 'linear-gradient(145deg, #0f172a 0%, #1d4ed8 100%)',
  color: '#f8fafc',
  boxShadow: '0 32px 90px rgba(30, 41, 59, 0.22)',
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

export function CourseModulesPage() {
  const [items, setItems] = useState<CourseModuleResponse[]>([]);
  const [form, setForm] = useState<CourseModuleRequest>(initialForm);
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchCourseModuleItems().then(setItems).catch(() => setItems([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');
    setErrorMessage('');

    try {
      const created = await createCourseModule({
        moduleName: form.moduleName,
        moduleDescription: form.moduleDescription,
        displayOrder: form.displayOrder,
      });
      setItems((current) => [created, ...current]);
      setForm(initialForm);
      setFeedback('Modulo adicionado com sucesso.');
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
            Estrutura do curso
          </span>

          <div style={{ display: 'grid', gap: 14 }}>
            <h1 style={{ margin: 0, fontSize: 52, lineHeight: 1, letterSpacing: '-0.04em' }}>
              Organize o curso em modulos claros, progressivos e faceis de navegar.
            </h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.7, color: 'rgba(248, 250, 252, 0.82)', maxWidth: 620 }}>
              Uma boa estrutura deixa a jornada mais intuitiva, melhora a retencao e facilita a
              expansao do catalogo ao longo do tempo.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {[
              ['Modulos criados', `${items.length}`],
              ['Proxima ordem', form.displayOrder || '1'],
              ['Curso em foco', 'Ativo'],
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
              'Agrupe assuntos que fazem sentido juntos para manter ritmo e contexto.',
              'Defina a ordem de exibicao pensando na evolucao natural do aluno.',
              'Use descricoes curtas para orientar sem poluir a navegacao.',
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
              <h2 style={{ margin: 0, fontSize: 28, color: '#0f172a' }}>Novo modulo</h2>
              <p style={{ margin: 0, color: '#64748b', lineHeight: 1.6 }}>
                Crie secoes logicas para distribuir o conteudo do curso.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
              <label style={labelStyle}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Nome do modulo</span>
                <input
                  type="text"
                  value={form.moduleName}
                  placeholder="Ex.: Fundamentos do curso"
                  onChange={(event) => setForm((current) => ({ ...current, moduleName: event.target.value }))}
                  style={inputStyle}
                />
                <small style={hintStyle}>Use um nome objetivo e facil de localizar no indice.</small>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Descricao do modulo</span>
                <textarea
                  value={form.moduleDescription}
                  placeholder="Resumo curto do que sera tratado neste modulo."
                  onChange={(event) => setForm((current) => ({ ...current, moduleDescription: event.target.value }))}
                  style={{ ...inputStyle, minHeight: 132, resize: 'vertical' as const }}
                />
                <small style={hintStyle}>Ajuda o aluno a entender o que vai aprender antes de entrar.</small>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Ordem de exibicao</span>
                <input
                  type="number"
                  value={form.displayOrder}
                  placeholder="1"
                  onChange={(event) => setForm((current) => ({ ...current, displayOrder: event.target.value }))}
                  style={inputStyle}
                />
                <small style={hintStyle}>Controle a sequencia em que o modulo aparece no curso.</small>
              </label>

              <button
                type="submit"
                style={{
                  padding: '15px 18px',
                  borderRadius: 16,
                  border: 'none',
                  background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  boxShadow: '0 18px 36px rgba(59, 130, 246, 0.28)',
                }}
              >
                Adicionar modulo
              </button>
            </form>

            {feedback ? <p style={{ marginTop: 16, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
            {errorMessage ? <p style={{ marginTop: 16, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
          </div>

          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Mapa de modulos</h3>
                <p style={{ margin: '6px 0 0', color: '#64748b' }}>Visualize a espinha dorsal do curso.</p>
              </div>
              <span
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {items.length} modulo(s)
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
                      {String(item.moduleName || item.id)}
                    </strong>
                    <span style={{ display: 'block', marginTop: 6, color: '#64748b' }}>
                      Ordem {String(item.displayOrder || '-')}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: '#64748b' }}>Nenhum modulo adicionado ainda.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
