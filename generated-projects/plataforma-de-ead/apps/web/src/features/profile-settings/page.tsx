import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ProfileSettingsRequest, ProfileSettingsResponse } from '../../../../../packages/shared/src/contracts/profile-settings.ts';
import { createProfileSettings, fetchProfileSettingsItems } from './service';

const initialForm: ProfileSettingsRequest = {
  fullName: '',
  profilePhotoUrl: '',
  email: '',
  password: '',
};

export function ProfileSettingsPage() {
  const [items, setItems] = useState<ProfileSettingsResponse[]>([]);
  const [form, setForm] = useState<ProfileSettingsRequest>(initialForm);
  const [feedback, setFeedback] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchProfileSettingsItems().then(setItems).catch(() => setItems([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');
    setErrorMessage('');

    try {
      const created = await createProfileSettings({
      fullName: form.fullName,
      profilePhotoUrl: form.profilePhotoUrl,
      email: form.email,
      password: form.password,
      });
      setItems((current) => [...current, created]);
      setForm(initialForm);
      setFeedback('Perfil atualizado com sucesso.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.');
    }
  }

  return (
    <section style={{ minHeight: '100vh', background: '#f8fafc', padding: 32 }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', display: 'grid', gap: 32, gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)' }}>
        <div style={{ display: 'grid', gap: 18, alignContent: 'start', paddingTop: 32 }}>
          <span style={{ display: 'inline-flex', width: 'fit-content', padding: '8px 14px', borderRadius: 999, background: '#ccfbf1', color: '#115e59', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', fontSize: 12 }}>
            Perfil
          </span>
          <div style={{ display: 'grid', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 44, lineHeight: 1.05, color: '#0f172a' }}>Informações Pessoais</h2>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: '#475569', maxWidth: 560 }}>Altere seu nome, foto e e-mail para personalizar sua experiência.</p>
          </div>
          <div style={{ display: 'grid', gap: 14, padding: 24, borderRadius: 24, background: 'linear-gradient(135deg, #0f766e, #115e59)', color: '#f8fafc', boxShadow: '0 24px 60px rgba(15, 118, 110, 0.22)' }}>
            <strong style={{ fontSize: 16 }}>Seu Espaço</strong>
            <p style={{ margin: 0, lineHeight: 1.6, color: 'rgba(248, 250, 252, 0.88)' }}>Altere seu nome, foto e e-mail para personalizar sua experiência.</p>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ padding: '14px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.1)' }}>Nome completo é obrigatório.</div>
              <div style={{ padding: '14px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.1)' }}>E-mail único.</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          <div style={{ padding: 28, borderRadius: 28, background: '#ffffff', boxShadow: '0 22px 50px rgba(15, 23, 42, 0.08)', border: '1px solid #e2e8f0' }}>
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Nome completo</span>
          <input
            type="text"
            value={form.fullName}
            placeholder="Digite seu nome completo"
            onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
          <small style={{ color: '#64748b' }}>Informe o nome que sera exibido no seu perfil.</small>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Foto do perfil</span>
          <input
            type="url"
            value={form.profilePhotoUrl}
            placeholder="https://exemplo.com/minha-foto.png"
            onChange={(event) => setForm((current) => ({ ...current, profilePhotoUrl: event.target.value }))}
            style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
          <small style={{ color: '#64748b' }}>Informe a URL da imagem do perfil. Considere JPG/PNG com limite de 2MB no ambiente real.</small>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>E-mail</span>
          <input
            type="email"
            value={form.email}
            placeholder="Digite seu e-mail"
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
          <small style={{ color: '#64748b' }}>Use um e-mail valido para acessar a plataforma.</small>
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Senha</span>
          <input
            type="password"
            value={form.password}
            placeholder="Crie uma senha segura"
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            style={{ padding: 12, borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
          <small style={{ color: '#64748b' }}>A senha deve atender aos criterios minimos de seguranca.</small>
        </label>
              <button type="submit" style={{ padding: '14px 18px', borderRadius: 14, border: 'none', background: '#0f766e', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                Salvar Alterações
              </button>
            </form>

            {feedback ? <p style={{ marginTop: 16, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
            {errorMessage ? <p style={{ marginTop: 16, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
          </div>

          <div style={{ padding: 24, borderRadius: 24, background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 16px 40px rgba(15, 23, 42, 0.06)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 12, color: '#0f172a' }}>Informações Salvas</h3>
            {items.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', display: 'grid', gap: 8 }}>
                {items.map((item) => (
                  <li key={item.id}>{String(item.email || item.id)}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: '#64748b' }}>Nenhuma informação encontrada. Comece a editar seu perfil!</p>
            )}
          </div>
          <div style={{ padding: 24, borderRadius: 24, background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 16px 40px rgba(15, 23, 42, 0.06)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 12, color: '#0f172a' }}>Cenarios de QA mapeados</h3>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', display: 'grid', gap: 8 }}>
                  <li>Nome obrigatorio.</li>
                  <li>E-mail ja cadastrado.</li>
                  <li>Senha invalida.</li>
                  <li>E-mail invalido.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
