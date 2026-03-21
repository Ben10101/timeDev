import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { LessonMaterialRequest, LessonMaterialResponse } from '../../../../../packages/shared/src/contracts/lesson-materials.ts';
import { createLessonMaterial, fetchLessonMaterialItems } from './service';

const initialForm: LessonMaterialRequest = {
  materialTitle: '',
  fileType: 'pdf',
  fileUrl: '',
};

const pageShellStyle = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top left, rgba(245, 158, 11, 0.14), transparent 28%), linear-gradient(180deg, #fffaf0 0%, #fff7ed 100%)',
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
  background: 'linear-gradient(145deg, #451a03 0%, #d97706 100%)',
  color: '#fffbeb',
  boxShadow: '0 32px 90px rgba(146, 64, 14, 0.2)',
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
            Biblioteca de materiais
          </span>

          <div style={{ display: 'grid', gap: 14 }}>
            <h1 style={{ margin: 0, fontSize: 52, lineHeight: 1, letterSpacing: '-0.04em' }}>
              Entregue materiais complementares que reforcam cada aula sem complicar a operacao.
            </h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.7, color: 'rgba(255, 251, 235, 0.86)', maxWidth: 620 }}>
              Centralize PDFs, planilhas, checklists e links de apoio para tornar a experiencia de
              estudo mais completa e valiosa.
            </p>
          </div>

          <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {[
              ['Materiais enviados', `${items.length}`],
              ['Formato atual', form.fileType || 'pdf'],
              ['Entrega pronta', form.fileUrl ? 'Sim' : 'Pendente'],
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
                <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255, 251, 235, 0.66)' }}>
                  {label}
                </div>
                <strong style={{ display: 'block', marginTop: 10, fontSize: 28 }}>{value}</strong>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {[
              'Agrupe materiais por finalidade: apoio, pratica ou aprofundamento.',
              'Use titulos claros para facilitar busca e download pelo aluno.',
              'Prefira links estaveis para evitar materiais quebrados no curso.',
            ].map((item) => (
              <div
                key={item}
                style={{
                  padding: '15px 18px',
                  borderRadius: 18,
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255, 251, 235, 0.9)',
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
              <h2 style={{ margin: 0, fontSize: 28, color: '#0f172a' }}>Novo material</h2>
              <p style={{ margin: 0, color: '#64748b', lineHeight: 1.6 }}>
                Cadastre um recurso complementar e deixe a entrega pronta para consulta.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
              <label style={labelStyle}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Titulo do material</span>
                <input
                  type="text"
                  value={form.materialTitle}
                  placeholder="Ex.: Checklist da aula"
                  onChange={(event) => setForm((current) => ({ ...current, materialTitle: event.target.value }))}
                  style={inputStyle}
                />
                <small style={hintStyle}>Diga claramente o que o aluno vai encontrar ao abrir o material.</small>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>Tipo de arquivo</span>
                <select
                  value={form.fileType}
                  onChange={(event) => setForm((current) => ({ ...current, fileType: event.target.value }))}
                  style={inputStyle}
                >
                  <option value="pdf">PDF</option>
                  <option value="planilha">Planilha</option>
                  <option value="zip">ZIP</option>
                  <option value="link">Link</option>
                </select>
                <small style={hintStyle}>Escolha o formato que melhor representa o recurso enviado.</small>
              </label>

              <label style={labelStyle}>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>URL do arquivo</span>
                <input
                  type="url"
                  value={form.fileUrl}
                  placeholder="https://cdn.exemplo.com/material.pdf"
                  onChange={(event) => setForm((current) => ({ ...current, fileUrl: event.target.value }))}
                  style={inputStyle}
                />
                <small style={hintStyle}>Use um link estavel para liberar download ou acesso imediato.</small>
              </label>

              <button
                type="submit"
                style={{
                  padding: '15px 18px',
                  borderRadius: 16,
                  border: 'none',
                  background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  boxShadow: '0 18px 36px rgba(245, 158, 11, 0.28)',
                }}
              >
                Enviar material
              </button>
            </form>

            {feedback ? <p style={{ marginTop: 16, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
            {errorMessage ? <p style={{ marginTop: 16, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
          </div>

          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: '#0f172a', fontSize: 22 }}>Biblioteca cadastrada</h3>
                <p style={{ margin: '6px 0 0', color: '#64748b' }}>Consulte os materiais complementares ja enviados.</p>
              </div>
              <span
                style={{
                  padding: '8px 12px',
                  borderRadius: 999,
                  background: '#fef3c7',
                  color: '#b45309',
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {items.length} item(ns)
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
                      background: '#fffaf0',
                      border: '1px solid #fde68a',
                    }}
                  >
                    <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>
                      {String(item.materialTitle || item.id)}
                    </strong>
                    <span style={{ display: 'block', marginTop: 6, color: '#92400e' }}>
                      Tipo: {String(item.fileType || '-')}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, color: '#64748b' }}>Nenhum material complementar cadastrado ainda.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
