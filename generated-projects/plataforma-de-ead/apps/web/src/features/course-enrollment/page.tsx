import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { CourseEnrollmentRequest, CourseEnrollmentResponse } from '../../../../../packages/shared/src/contracts/course-enrollment.ts';
import { FeaturePage, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx';
import { createCourseEnrollment, fetchCourseEnrollmentItems } from './service';

const initialForm: CourseEnrollmentRequest = {
  fullName: '',
  profilePhotoUrl: '',
  email: '',
  password: '',
};

export function CourseEnrollmentPage() {
  const [items, setItems] = useState<CourseEnrollmentResponse[]>([]);
  const [form, setForm] = useState<CourseEnrollmentRequest>(initialForm);
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchCourseEnrollmentItems().then(setItems).catch(() => setItems([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');
    setErrorMessage('');

    try {
      const created = await createCourseEnrollment({
      fullName: form.fullName,
      profilePhotoUrl: form.profilePhotoUrl,
      email: form.email,
      password: form.password,
      });
      setItems((current) => [created, ...current]);
      setForm(initialForm);
      setFeedback('Matricula criada com sucesso.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.');
    }
  }

  return (
    <FeaturePage
      accent="teal"
      layout="dashboard"
      eyebrow="Matriculas"
      title="Gerencie matriculas"
      description="Associe alunos aos cursos disponiveis para liberar acesso ao conteudo."
      metrics={[
        { label: 'Campos essenciais', value: '4' },
        { label: 'Registros atuais', value: String(items.length) },
        { label: 'Acao principal', value: 'Matricular Aluno' },
      ]}
      highlights={["Fluxo pensado para reduzir duvidas no preenchimento.","Feedback claro ao concluir ou revisar a operacao."]}
      formTitle="Dados principais"
      formDescription="Preencha os dados essenciais para concluir a operacao com seguranca."
      form={
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Nome completo" hint="Informe o nome que sera exibido no seu perfil.">
            <input
              type="text"
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              placeholder="Digite seu nome completo"
              style={inputStyle()}
            />
          </FieldGroup>
          <FieldGroup label="Foto do perfil" hint="Informe a URL da imagem do perfil. Considere JPG/PNG com limite de 2MB no ambiente real.">
            <input
              type="url"
              value={form.profilePhotoUrl}
              onChange={(event) => setForm((current) => ({ ...current, profilePhotoUrl: event.target.value }))}
              placeholder="https://exemplo.com/minha-foto.png"
              style={inputStyle()}
            />
          </FieldGroup>
          <FieldGroup label="E-mail" hint="Use um e-mail valido para acessar a plataforma.">
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="Digite seu e-mail"
              style={inputStyle()}
            />
          </FieldGroup>
          <FieldGroup label="Senha" hint="A senha deve atender aos criterios minimos de seguranca.">
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              placeholder="Crie uma senha segura"
              style={inputStyle()}
            />
          </FieldGroup>
          <PrimaryButton type="submit" accent="teal">
            Matricular Aluno
          </PrimaryButton>

          {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
          {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
        </form>
      }
      listTitle="Registros recentes"
      listDescription="Nenhum registro disponivel ainda."
      listMeta={`${items.length} registro(s)`}
    >
      {items.length ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <article key={item.id} style={{ padding: 18, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>{String(item.email || item.id)}</strong>
              <span style={{ display: 'block', marginTop: 6, color: '#64748b' }}>{String(item.fullName || item.status || 'active')}</span>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Nenhum registro disponivel ainda.</p>
      )}
    </FeaturePage>
  );
}
