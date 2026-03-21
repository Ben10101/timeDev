import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { ProfileSettingsRequest, ProfileSettingsResponse } from '../../../../../packages/shared/src/contracts/profile-settings.ts'
import { FeaturePage, FieldGroup, PrimaryButton, inputStyle } from '../../../../../packages/ui/src/index.tsx'
import { createProfileSettings, fetchProfileSettingsItems } from './service'

const initialForm: ProfileSettingsRequest = {
  fullName: '',
  profilePhotoUrl: '',
  email: '',
  password: '',
}

export function ProfileSettingsPage() {
  const [items, setItems] = useState<ProfileSettingsResponse[]>([])
  const [form, setForm] = useState<ProfileSettingsRequest>(initialForm)
  const [feedback, setFeedback] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    fetchProfileSettingsItems().then(setItems).catch(() => setItems([]))
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback('')
    setErrorMessage('')

    try {
      const created = await createProfileSettings(form)
      setItems((current) => [created, ...current])
      setForm(initialForm)
      setFeedback('Perfil atualizado com sucesso.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao enviar formulario.')
    }
  }

  return (
    <FeaturePage
      accent="amber"
      layout="settings"
      eyebrow="Perfil"
      title="Mantenha sua conta pronta para estudar, vender e evoluir."
      description="Atualize nome, foto, e-mail e senha para manter sua presenca consistente na plataforma e evitar friccao de acesso."
      metrics={[
        { label: 'Campos da conta', value: '4' },
        { label: 'Atualizacoes', value: String(items.length) },
        { label: 'Seguranca', value: 'Ativa' },
      ]}
      highlights={[
        'Nome claro ajuda alunos e operacao a reconhecer sua conta.',
        'E-mail valido garante login e comunicacao sem ruido.',
        'Senha forte protege sua operacao e seus conteudos.',
      ]}
      formTitle="Dados da conta"
      formDescription="Revise as informacoes principais e mantenha o acesso sempre sob controle."
      form={
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 18 }}>
          <FieldGroup label="Nome completo" hint="Informe o nome que sera exibido no seu perfil.">
            <input
              type="text"
              value={form.fullName}
              placeholder="Digite seu nome completo"
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              style={inputStyle()}
            />
          </FieldGroup>

          <FieldGroup label="Foto do perfil" hint="Use uma URL de imagem valida para o avatar da conta.">
            <input
              type="url"
              value={form.profilePhotoUrl}
              placeholder="https://exemplo.com/minha-foto.png"
              onChange={(event) => setForm((current) => ({ ...current, profilePhotoUrl: event.target.value }))}
              style={inputStyle()}
            />
          </FieldGroup>

          <FieldGroup label="E-mail" hint="Esse e-mail sera usado para login e comunicacoes.">
            <input
              type="email"
              value={form.email}
              placeholder="Digite seu e-mail"
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              style={inputStyle()}
            />
          </FieldGroup>

          <FieldGroup label="Senha" hint="Use ao menos 8 caracteres com letras e numeros.">
            <input
              type="password"
              value={form.password}
              placeholder="Crie uma senha segura"
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              style={inputStyle()}
            />
          </FieldGroup>

          <PrimaryButton type="submit" accent="amber">
            Salvar alteracoes
          </PrimaryButton>

          {feedback ? <p style={{ margin: 0, color: '#047857', fontWeight: 600 }}>{feedback}</p> : null}
          {errorMessage ? <p style={{ margin: 0, color: '#b91c1c', fontWeight: 600 }}>{errorMessage}</p> : null}
        </form>
      }
      listTitle="Atualizacoes recentes"
      listDescription="Acompanhe os ultimos ajustes feitos na conta."
      listMeta={`${items.length} atualizacao(oes)`}
    >
      {items.length ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <article key={item.id} style={{ padding: 18, borderRadius: 20, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <strong style={{ display: 'block', color: '#0f172a', fontSize: 17 }}>{String(item.email || item.id)}</strong>
              <span style={{ display: 'block', marginTop: 6, color: '#64748b' }}>{String(item.fullName || 'Perfil sem nome')}</span>
            </article>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, color: '#64748b' }}>Nenhuma atualizacao realizada ainda.</p>
      )}
    </FeaturePage>
  )
}
