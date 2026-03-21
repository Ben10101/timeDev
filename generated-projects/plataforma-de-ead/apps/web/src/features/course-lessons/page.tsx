import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CourseLessonRequest, CourseLessonResponse } from '../../../../../packages/shared/src/contracts/course-lessons.ts';
import { createCourseLesson, fetchCourseLessonItems } from './service';

const initialForm: CourseLessonRequest = {
  lessonTitle: '',
  mediaType: 'video',
  moduleReference: '',
};

const pageShellStyle = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top left, rgba(124, 58, 237, 0.12), transparent 28%), linear-gradient(180deg, #f8fafc 0%, #f5f3ff 100%)',
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
  background: 'linear-gradient(145deg, #1e1b4b 0%, #7c3aed 100%)',
  color: '#f8fafc',
  boxShadow: '0 32px 90px rgba(76, 29, 149, 0.2)',
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
            Aulas do curso
          </span>

          <div style={{ display: 'grid', gap: 14 }}>
            <h1 style={{ margin: 0, fontSize: 52, lineHeight: 1, letterSpacing: '-0.04em' }}>
              Monte uma experiencia de aula mais rica, modular e facil de consumir.
            </h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.7, color: 'rgba(248, 250, 252, 0.82)', maxWidth: 620 }}>
              Cadastre aulas com titulo claro, tipo de midia bem definido e relacao direta com o
              modulo certo para manter o fluxo de aprendizagem consistente.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {[
              ['Aulas criadas', `${items.length}`],
              ['Midia atual', form.mediaType || 'video'],
              ['Modulo alvo', form.moduleReference || 'Nao definido'],
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
              'Diferencie aulas introdutorias, praticas e materiais de apoio.',
              'Vincule cada aula ao modulo certo para evitar confusao de contexto.',
              'Escolha a midia pensando no formato ideal para consumo do aluno.',
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
              <h2 style={{ margin: 0, fontSize: 28, color: '#0f172a' }}>Nova aula</h2>
              <p style={{ margin: 0, color: '#64748b', lineHeight: 1.6 }}>
                Registre uma aula e conecte esse conteudo ao modulo certo.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
              <label style={labelStyle}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Titulo da aula</span>
                <input
                  type="text"
                  value={form.lessonTitle}
                  placeholder="Ex.: Instalando o ambiente"
                  onChange={(event) => setForm((current) => ({ ...current, lessonTitle: event.target.value }))}
                  style={inputStyle}
                />
                <small style={hintStyle}>Escolha um titulo simples e facil de localizar na trilha.</small>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Tipo de midia</span>
                <select
                  value={form.mediaType}
                  onChange={(event) => setForm((current) => ({ ...current, mediaType: event.target.value }))}
                  style={inputStyle}
                >
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="pdf">PDF</option>
                </select>
                <small style={hintStyle}>Defina o formato principal de consumo da aula.</small>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Modulo relacionado</span>
                <input
                  type="text"
                  value={form.moduleReference}
                  placeholder="Ex.: Fundamentos do curso"
                  onChange={(event) => setForm((current) => ({ ...current, moduleReference: event.target.value }))}
                  style={inputStyle}
                />
                <small style={hintStyle}>Associe a aula ao bloco correto para manter a progressao.</small>
              </label>

              <button
                type="submit"
                style={{
                  padding: '15px 18px',
                  borderRadius: 16,
                  border: 'none',
                  background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  boxShadow: '0 18px 36px rgba(168, 85, 247, 0.26)',
                }}
              >
                Adicionar aula
              </button>
            </form>

            {feedback ? <p style={{ marginTop: 16, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
            {errorMessage ? <p style={{ marginTop: 16, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
          </div>

          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Trilha de aulas</h3>
                <p style={{ margin: '6px 0 0', color: '#64748b' }}>Veja as aulas ja cadastradas e prontas para compor o curso.</p>
              </div>
              <span
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: '#ede9fe',
                  color: '#6d28d9',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {items.length} aula(s)
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
                      {String(item.lessonTitle || item.id)}
                    </strong>
                    <span style={{ display: 'block', marginTop: 6, color: '#64748b' }}>
                      Midia: {String(item.mediaType || '-')}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: '#64748b' }}>Nenhuma aula adicionada ainda.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
