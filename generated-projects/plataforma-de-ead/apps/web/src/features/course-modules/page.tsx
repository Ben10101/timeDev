import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CourseModuleRequest, CourseModuleResponse } from '../../../../../packages/shared/src/contracts/course-modules.ts';
import { FeaturePage, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { createCourseModule, fetchCourseModuleItems } from './service';

const initialForm: CourseModuleRequest = {
  moduleName: '',
  moduleDescription: '',
  displayOrder: '1',
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
    <FeaturePage
      accent="blue"
      layout="split"
      eyebrow="Curso"
      title="Crie módulos organizados"
      description="Separe seu curso em seções lógicas para facilitar o aprendizado."
      metrics={[
        { label: 'Campos essenciais', value: '3' },
        { label: 'Registros atuais', value: String(items.length) },
        { label: 'Acao principal', value: 'Adicionar Módulo' },
      ]}
      highlights={["Estruture o conteúdo em módulos claros","Defina a ordem de exibição dos módulos"]}
      formTitle="Novo módulo"
      formDescription="Preencha os dados para adicionar um módulo ao curso."
      form={
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Nome do modulo" hint="Defina um titulo objetivo para o modulo.">
            <input
              type="text"
              value={form.moduleName}
              onChange={(event) => setForm((current) => ({ ...current, moduleName: event.target.value }))}
              placeholder="Ex.: Fundamentos do curso"
              style={inputStyle()}
            />
          </FieldGroup>
          <FieldGroup label="Descricao do modulo" hint="Explique rapidamente o que sera abordado neste modulo.">
            <input
              type="text"
              value={form.moduleDescription}
              onChange={(event) => setForm((current) => ({ ...current, moduleDescription: event.target.value }))}
              placeholder="Resumo curto do modulo"
              style={inputStyle()}
            />
          </FieldGroup>
          <FieldGroup label="Ordem" hint="Controle a sequencia em que o modulo aparece no curso.">
            <input
              type="number"
              value={form.displayOrder}
              onChange={(event) => setForm((current) => ({ ...current, displayOrder: event.target.value }))}
              placeholder="1"
              style={inputStyle()}
            />
          </FieldGroup>
          <PrimaryButton type="submit" accent="blue">
            Adicionar Módulo
          </PrimaryButton>

          {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
          {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
        </form>
      }
      listTitle="Módulos existentes"
      listDescription="Acompanhe os registros criados nesta area."
      listMeta={`${items.length} registro(s)`}
    >
      {items.length ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <article key={item.id} style={{ padding: 18, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>{String(item.moduleName || item.id)}</strong>
              <span style={{ display: 'block', marginTop: 6, color: '#64748b' }}>{String(item.moduleDescription || item.status || 'active')}</span>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Nenhum módulo adicionado ainda.</p>
      )}
    </FeaturePage>
  );
}
