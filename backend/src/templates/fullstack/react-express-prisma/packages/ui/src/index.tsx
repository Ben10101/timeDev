import React from 'react'
import type { CSSProperties, ReactNode } from 'react'

export const tokens = {
  color: {
    text: '#1f2a44',
    muted: '#7b879d',
    mutedStrong: '#49566d',
    border: '#d9deea',
    surface: '#ffffff',
    surfaceStrong: '#ffffff',
    surfaceAlt: '#f4f6fb',
    accent: '#2451b7',
    accentStrong: '#17377d',
    accentSoft: '#dde7ff',
    shell: '#23284d',
    shellSoft: '#303762',
    shellBorder: '#d7dced',
    success: '#0f766e',
    danger: '#b42318',
  },
  radius: {
    card: 18,
    control: 12,
    pill: 999,
  },
  shadow: {
    panel: '0 10px 28px rgba(15, 23, 42, 0.05)',
    header: '0 12px 30px rgba(8, 15, 32, 0.24)',
  },
}

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#eef1f7',
        color: tokens.color.text,
        fontFamily: '"Manrope", "Segoe UI", sans-serif',
      }}
    >
      {children}
    </main>
  )
}

export function AppHeader({
  title,
}: {
  title: string
  activePath: string
  routes: Array<{ path: string; label: string }>
}) {
  return (
    <header
      style={{
        height: 56,
        padding: '0 18px',
        background: tokens.color.shell,
        color: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: tokens.shadow.header,
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div style={{ width: 28, display: 'grid', gap: 4 }}>
          <span style={{ height: 2, borderRadius: 999, background: 'rgba(255,255,255,0.94)' }} />
          <span style={{ height: 2, borderRadius: 999, background: 'rgba(255,255,255,0.94)' }} />
          <span style={{ height: 2, borderRadius: 999, background: 'rgba(255,255,255,0.94)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <strong style={{ fontSize: 16 }}>Início</strong>
          <span style={{ color: 'rgba(248,250,252,0.55)' }}>›</span>
          <strong style={{ fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</strong>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 18, opacity: 0.9 }}>◔</span>
        <strong style={{ fontSize: 14 }}>Supervisor</strong>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#eef1f7',
            color: tokens.color.shell,
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          BL
        </span>
      </div>
    </header>
  )
}

export function SidebarNav({
  routes,
  activePath,
}: {
  routes: Array<{ path: string; label: string }>
  activePath: string
}) {
  return (
    <aside
      style={{
        width: 234,
        minHeight: 'calc(100vh - 56px)',
        background: '#ffffff',
        borderRight: `1px solid ${tokens.color.shellBorder}`,
        display: 'grid',
        alignContent: 'start',
      }}
    >
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${tokens.color.shellBorder}` }}>
        <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
          Navegação
        </div>
      </div>

      <nav style={{ display: 'grid' }}>
        {routes.map((route) => {
          const active = activePath === route.path
          return (
            <a
              key={route.path}
              href={route.path}
              style={{
                padding: '14px 16px',
                textDecoration: 'none',
                color: active ?tokens.color.shell : tokens.color.mutedStrong,
                fontWeight: active ?800 : 600,
                background: active ?'#eef2ff' : 'transparent',
                borderLeft: active ?`3px solid ${tokens.color.accent}` : '3px solid transparent',
                borderBottom: `1px solid ${tokens.color.shellBorder}`,
              }}
            >
              {route.label}
            </a>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: 16, fontSize: 12, color: tokens.color.muted }}>
        Workspace pronto para evoluÃ§Ã£o incremental.
      </div>
    </aside>
  )
}

export function StudioHome({
  title,
  routes,
}: {
  title: string
  routes: Array<{ path: string; label: string }>
}) {
  return (
    <section
      style={{
        display: 'grid',
        gap: 20,
        padding: 24,
        borderRadius: tokens.radius.card,
        background: '#ffffff',
        border: `1px solid ${tokens.color.border}`,
        boxShadow: tokens.shadow.panel,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 8, maxWidth: 760 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
            Visão geral
          </div>
          <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, letterSpacing: '-0.03em', color: tokens.color.shell }}>{title}</h1>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: tokens.color.mutedStrong }}>
            Estrutura base pronta para evoluir mÃ³dulos operacionais, fluxos de cadastro e jornadas de acompanhamento com mais consistÃªncia.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: tokens.color.muted, fontWeight: 700 }}>?ltima atualizaÃ§Ã£o</div>
          <strong style={{ display: 'block', marginTop: 6, color: tokens.color.shell }}>Agora</strong>
        </div>
      </div>

      <MetricRow
        items={[
          { label: 'MÃ³dulos ativos', value: String(routes.length) },
          { label: 'NavegaÃ§Ã£o', value: 'Pronta' },
          { label: 'Base', value: 'Web + API' },
        ]}
      />

      <div style={{ display: 'grid', gap: 12 }}>
        {routes.map((route) => (
          <a
            key={route.path}
            href={route.path}
            style={{
              padding: '16px 18px',
              borderRadius: 14,
              textDecoration: 'none',
              color: tokens.color.text,
              background: tokens.color.surfaceAlt,
              border: `1px solid ${tokens.color.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <strong style={{ fontSize: 16 }}>{route.label}</strong>
            <span style={{ color: tokens.color.mutedStrong, fontWeight: 700 }}>Abrir</span>
          </a>
        ))}
      </div>
    </section>
  )
}

function getFeatureModeProfile(productMode: string) {
  const profiles: Record<string, Record<string, unknown>> = {
    'governance-console': {
      heroDark: true,
      metricDark: true,
      reversePanels: false,
      bodyColumns: 'minmax(380px, 0.92fr) minmax(0, 1.08fr)',
      searchLabel: 'Localizar perfil, regra ou escopo',
      tableLabels: ['Perfil', 'Escopo', 'Atualizacao'],
      asideTitle: 'Governanca ativa',
      asideTone: 'Controle claro para acesso, risco e decisao.',
      highlightVariant: 'pills',
      recordsVariant: 'policy-grid',
      formVariant: 'console',
    },
    'self-service-settings': {
      heroDark: false,
      metricDark: false,
      reversePanels: false,
      bodyColumns: 'minmax(360px, 0.98fr) minmax(300px, 0.82fr)',
      searchLabel: 'Buscar ajuste ou preferencia',
      tableLabels: ['Ajuste', 'Estado', 'Atualizacao'],
      asideTitle: 'Resumo atual',
      asideTone: 'Ajustes simples, com leitura clara do que esta ativo agora.',
      highlightVariant: 'soft-list',
      recordsVariant: 'summary',
      formVariant: 'settings',
    },
    'evidence-workbench': {
      heroDark: false,
      metricDark: false,
      reversePanels: true,
      bodyColumns: 'minmax(0, 1.12fr) minmax(360px, 0.88fr)',
      searchLabel: 'Localizar comprovante, link ou referencia',
      tableLabels: ['Documento', 'Status', 'Envio'],
      asideTitle: 'Contexto do caso',
      asideTone: 'Organize evidencias com foco em triagem e rapidez de analise.',
      highlightVariant: 'chips',
      recordsVariant: 'evidence',
      formVariant: 'workbench',
    },
    'manager-cockpit': {
      heroDark: true,
      metricDark: true,
      reversePanels: true,
      bodyColumns: 'minmax(0, 1.14fr) minmax(360px, 0.86fr)',
      searchLabel: 'Filtrar indicador ou recorte',
      tableLabels: ['Indicador', 'Estado', 'Atualizacao'],
      asideTitle: 'Leitura executiva',
      asideTone: 'A tela precisa apoiar decisao, comparacao e visao consolidada.',
      highlightVariant: 'cards',
      recordsVariant: 'insights',
      formVariant: 'support',
    },
    'review-workbench': {
      heroDark: true,
      metricDark: false,
      reversePanels: true,
      bodyColumns: 'minmax(0, 1.08fr) minmax(360px, 0.92fr)',
      searchLabel: 'Buscar item para revisar',
      tableLabels: ['Item', 'Decisao', 'Atualizacao'],
      asideTitle: 'Fila de revisao',
      asideTone: 'Mantenha a fila clara para aprovar, ajustar e seguir rapido.',
      highlightVariant: 'cards',
      recordsVariant: 'queue',
      formVariant: 'support',
    },
    'onboarding-flow': {
      heroDark: false,
      metricDark: false,
      reversePanels: false,
      bodyColumns: 'minmax(360px, 0.95fr) minmax(320px, 0.85fr)',
      searchLabel: 'Ver proximas etapas',
      tableLabels: ['Etapa', 'Status', 'Atualizacao'],
      asideTitle: 'Proxima etapa',
      asideTone: 'Avance pela jornada mantendo contexto e baixo atrito.',
      highlightVariant: 'steps',
      recordsVariant: 'steps',
      formVariant: 'settings',
    },
    'immersive-workspace': {
      heroDark: true,
      metricDark: false,
      reversePanels: false,
      bodyColumns: 'minmax(0, 1fr)',
      searchLabel: 'Filtrar atividade atual',
      tableLabels: ['Item', 'Estado', 'Atualizacao'],
      asideTitle: 'Foco principal',
      asideTone: 'Menos painel e mais concentracao na tarefa central.',
      highlightVariant: 'cards',
      recordsVariant: 'focus',
      formVariant: 'workbench',
    },
  }

  return {
    heroDark: false,
    metricDark: false,
    reversePanels: false,
    bodyColumns: 'minmax(340px, 420px) minmax(0, 1fr)',
    searchLabel: 'Pesquisar...',
    tableLabels: ['Registro', 'Status', 'Atualizacao'],
    asideTitle: 'Operacao viva',
    asideTone: 'Acompanhe o contexto principal desta area sem perder clareza.',
    highlightVariant: 'cards',
    recordsVariant: 'table',
    formVariant: 'panel',
    ...(profiles[productMode] || {}),
  }
}

export function FeaturePage({
  accent = 'teal',
  layout = 'split',
  productMode = 'structured-workspace',
  eyebrow,
  title,
  description,
  metrics,
  highlights,
  formTitle,
  formDescription,
  form,
  listTitle,
  listDescription,
  listMeta,
  children,
}: {
  accent?: 'teal' | 'blue' | 'violet' | 'amber'
  layout?: 'split' | 'stacked' | 'wizard' | 'dashboard' | 'workspace' | 'settings' | 'crud'
  productMode?: string
  eyebrow: string
  title: string
  description: string
  metrics?: Array<{ label: string; value: string }>
  highlights: string[]
  formTitle: string
  formDescription: string
  form: ReactNode
  listTitle: string
  listDescription: string
  listMeta: string
  children: ReactNode
}) {
  const accentMap: Record<string, string> = {
    teal: '#0f766e',
    blue: '#2451b7',
    violet: '#6d28d9',
    amber: '#b45309',
  }

  return (
    <section style={{ display: 'grid', gap: 18 }}>
      <div
        style={{
          padding: '18px 20px',
          borderRadius: tokens.radius.card,
          background: '#ffffff',
          border: `1px solid ${tokens.color.border}`,
          boxShadow: tokens.shadow.panel,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <Badge subtle>{eyebrow}</Badge>
            <div style={{ display: 'grid', gap: 6 }}>
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.05, letterSpacing: '-0.03em', color: tokens.color.shell }}>{title}</h1>
              <p style={{ margin: 0, color: tokens.color.mutedStrong, lineHeight: 1.7, maxWidth: 820 }}>{description}</p>
            </div>
          </div>
          <div style={{ minWidth: 180, textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: tokens.color.muted, fontWeight: 700 }}>?ltima atualização</div>
            <strong style={{ display: 'block', marginTop: 6, color: tokens.color.shell }}>Agora</strong>
          </div>
        </div>
      </div>

      <MetricRow items={metrics} />

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(340px, 420px) minmax(0, 1fr)' }}>
        <SurfaceCard title={formTitle} description={formDescription}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 14,
                background: `${accentMap[accent] || accentMap.teal}10`,
                border: `1px solid ${(accentMap[accent] || accentMap.teal)}22`,
                color: tokens.color.mutedStrong,
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {highlights[0] || 'Fluxo pronto para operaÃ§Ã£o com mais clareza.'}
            </div>
            {form}
          </div>
        </SurfaceCard>

        <SurfaceCard title={listTitle} description={listDescription} meta={listMeta}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                borderRadius: 14,
                background: '#f6f8fc',
                border: `1px solid ${tokens.color.border}`,
              }}
            >
              <span style={{ color: tokens.color.muted }}>⌕</span>
              <span style={{ color: tokens.color.mutedStrong }}>Pesquisar...</span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.3fr 0.8fr 0.9fr',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 12,
                background: '#f6f8fc',
                border: `1px solid ${tokens.color.border}`,
                color: tokens.color.mutedStrong,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              <span>Registro</span>
              <span>Status</span>
              <span>Atualização</span>
            </div>
            {children}
          </div>
        </SurfaceCard>
      </div>
    </section>
  )
}

export function FeatureWorkbench({
  accent = 'teal',
  productMode = 'structured-workspace',
  eyebrow,
  title,
  description,
  metrics,
  highlights,
  formTitle,
  formDescription,
  form,
  listTitle,
  listDescription,
  listMeta,
  children,
}: {
  accent?: 'teal' | 'blue' | 'violet' | 'amber'
  productMode?: string
  eyebrow: string
  title: string
  description: string
  metrics?: Array<{ label: string; value: string }>
  highlights: string[]
  formTitle: string
  formDescription: string
  form: ReactNode
  listTitle: string
  listDescription: string
  listMeta?: string
  children: ReactNode
}) {
  const accentMap: Record<string, string> = {
    teal: '#0f766e',
    blue: '#2451b7',
    violet: '#6d28d9',
    amber: '#b45309',
  }

  const accentColor = accentMap[accent] || accentMap.teal
  const modeProfile = getFeatureModeProfile(productMode)
  const heroDark = Boolean(modeProfile.heroDark)
  const metricDark = Boolean(modeProfile.metricDark)
  const reversePanels = Boolean(modeProfile.reversePanels)
  const bodyColumns = String(modeProfile.bodyColumns || 'minmax(340px, 420px) minmax(0, 1fr)')
  const searchLabel = String(modeProfile.searchLabel || 'Pesquisar...')
  const tableLabels = Array.isArray(modeProfile.tableLabels) ? modeProfile.tableLabels : ['Registro', 'Status', 'Atualizacao']
  const asideTitle = String(modeProfile.asideTitle || 'Operacao viva')
  const asideTone = String(modeProfile.asideTone || 'Acompanhe o contexto principal desta area sem perder clareza.')
  const highlightVariant = String(modeProfile.highlightVariant || 'cards')
  const recordsVariant = String(modeProfile.recordsVariant || 'table')
  const formVariant = String(modeProfile.formVariant || 'panel')

  const highlightNode =
    highlightVariant === 'pills' ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {highlights.map((item) => (
          <span
            key={item}
            style={{
              padding: '8px 11px',
              borderRadius: tokens.radius.pill,
              background: '#ffffff',
              border: `1px solid ${accentColor}22`,
              color: tokens.color.shell,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {item}
          </span>
        ))}
      </div>
    ) : highlightVariant === 'soft-list' ? (
      <div style={{ display: 'grid', gap: 10 }}>
        {highlights.map((item) => (
          <div
            key={item}
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: '#ffffff',
              border: `1px solid ${tokens.color.border}`,
              color: tokens.color.mutedStrong,
              lineHeight: 1.6,
            }}
          >
            {item}
          </div>
        ))}
      </div>
    ) : highlightVariant === 'chips' ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {highlights.map((item) => (
          <span
            key={item}
            style={{
              padding: '10px 12px',
              borderRadius: 14,
              background: `${accentColor}10`,
              border: `1px dashed ${accentColor}55`,
              color: tokens.color.shell,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            {item}
          </span>
        ))}
      </div>
    ) : highlightVariant === 'steps' ? (
      <div style={{ display: 'grid', gap: 10 }}>
        {highlights.map((item, index) => (
          <div key={item} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 12, alignItems: 'start' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: `${accentColor}15`,
                color: accentColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 12,
              }}
            >
              {index + 1}
            </div>
            <div style={{ paddingTop: 4, color: tokens.color.mutedStrong, lineHeight: 1.6 }}>{item}</div>
          </div>
        ))}
      </div>
    ) : (
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {highlights.map((item) => (
          <div
            key={item}
            style={{
              padding: '14px 16px',
              borderRadius: 16,
              border: `1px solid ${tokens.color.border}`,
              background: '#ffffff',
              boxShadow: tokens.shadow.panel,
              color: tokens.color.mutedStrong,
              lineHeight: 1.65,
            }}
          >
            {item}
          </div>
        ))}
      </div>
    )

  const recordsLeadNode =
    recordsVariant === 'summary' ? (
      <div style={{ display: 'grid', gap: 12 }}>
        {highlights.slice(0, 2).map((item) => (
          <div
            key={item}
            style={{
              padding: '14px 16px',
              borderRadius: 16,
              background: '#f8fafc',
              border: `1px solid ${tokens.color.border}`,
              color: tokens.color.mutedStrong,
              lineHeight: 1.65,
            }}
          >
            {item}
          </div>
        ))}
      </div>
    ) : recordsVariant === 'policy-grid' ? (
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {tableLabels.slice(0, 2).map((label) => (
          <div
            key={String(label)}
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: '#f8fafc',
              border: `1px solid ${tokens.color.border}`,
            }}
          >
            <div style={{ fontSize: 12, color: tokens.color.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {String(label)}
            </div>
            <div style={{ marginTop: 6, color: tokens.color.shell, fontWeight: 700 }}>Em definicao</div>
          </div>
        ))}
      </div>
    ) : recordsVariant === 'evidence' ? (
      <div
        style={{
          padding: '16px 18px',
          borderRadius: 18,
          background: `${accentColor}08`,
          border: `1px dashed ${accentColor}55`,
          color: tokens.color.mutedStrong,
          lineHeight: 1.7,
        }}
      >
        Mantenha comprovantes, links e anexos organizados para apoiar a triagem do chamado.
      </div>
    ) : recordsVariant === 'insights' ? (
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {tableLabels.map((label) => (
          <div
            key={String(label)}
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: '#111827',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.72, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{String(label)}</div>
            <div style={{ marginTop: 8, fontWeight: 800 }}>Acompanhando</div>
          </div>
        ))}
      </div>
    ) : recordsVariant === 'queue' ? (
      <div style={{ display: 'grid', gap: 10 }}>
        {['Prioridade alta', 'Em revisão', 'Pronto para decisão'].map((item) => (
          <div
            key={item}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 14,
              background: '#f8fafc',
              border: `1px solid ${tokens.color.border}`,
            }}
          >
            <strong style={{ color: tokens.color.shell }}>{item}</strong>
            <span style={{ color: tokens.color.mutedStrong, fontWeight: 700 }}>Fila ativa</span>
          </div>
        ))}
      </div>
    ) : recordsVariant === 'steps' ? (
      <div style={{ display: 'grid', gap: 10 }}>
        {['Preparar', 'Confirmar', 'Concluir'].map((item, index) => (
          <div key={item} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `${accentColor}15`, color: accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>
              {index + 1}
            </div>
            <div style={{ color: tokens.color.mutedStrong }}>{item}</div>
          </div>
        ))}
      </div>
    ) : null

  const formPanel = (
    <SurfaceCard title={formTitle} description={formDescription}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div
          style={{
            padding: '16px 18px',
            borderRadius: 18,
            background: formVariant === 'console' ? '#0f172a' : formVariant === 'settings' ? '#f8fafc' : `${accentColor}10`,
            border: formVariant === 'console' ? '1px solid rgba(255,255,255,0.08)' : `1px solid ${formVariant === 'settings' ? tokens.color.border : `${accentColor}28`}`,
            display: 'grid',
            gap: 10,
          }}
        >
          <strong style={{ color: formVariant === 'console' ? '#f8fafc' : tokens.color.shell, fontSize: 15 }}>{asideTitle}</strong>
          <p style={{ margin: 0, color: formVariant === 'console' ? 'rgba(248,250,252,0.76)' : tokens.color.mutedStrong, lineHeight: 1.7 }}>{asideTone}</p>
          {highlightVariant === 'pills' || highlightVariant === 'chips' ? highlightNode : null}
        </div>
        {form}
      </div>
    </SurfaceCard>
  )

  const recordsPanel = (
    <SurfaceCard title={listTitle} description={listDescription} meta={listMeta}>
      <div style={{ display: 'grid', gap: 14 }}>
        {recordsLeadNode}
        {recordsVariant !== 'summary' && recordsVariant !== 'steps' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 14,
              background: '#f6f8fc',
              border: `1px solid ${tokens.color.border}`,
            }}
          >
            <span style={{ color: tokens.color.muted }}>Buscar</span>
            <span style={{ color: tokens.color.mutedStrong }}>{searchLabel}</span>
          </div>
        ) : null}
        {recordsVariant !== 'summary' && recordsVariant !== 'steps' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 0.8fr 0.9fr',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 12,
              background: '#f6f8fc',
              border: `1px solid ${tokens.color.border}`,
              color: tokens.color.mutedStrong,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            <span>{String(tableLabels[0] || 'Registro')}</span>
            <span>{String(tableLabels[1] || 'Status')}</span>
            <span>{String(tableLabels[2] || 'Atualizacao')}</span>
          </div>
        ) : null}
        {children}
      </div>
    </SurfaceCard>
  )

  return (
    <section style={{ display: 'grid', gap: 20 }}>
      <div
        style={{
          padding: '22px 24px',
          borderRadius: 24,
          background: heroDark ? `linear-gradient(135deg, ${tokens.color.shell} 0%, ${tokens.color.shellSoft} 100%)` : '#ffffff',
          border: heroDark ? 'none' : `1px solid ${tokens.color.border}`,
          boxShadow: tokens.shadow.panel,
          color: heroDark ? '#f8fafc' : tokens.color.text,
        }}
      >
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'start' }}>
            <div style={{ display: 'grid', gap: 10, maxWidth: 820 }}>
              <Badge dark={heroDark} subtle={!heroDark}>{eyebrow}</Badge>
              <div style={{ display: 'grid', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.02, letterSpacing: '-0.03em', color: heroDark ? '#f8fafc' : tokens.color.shell }}>{title}</h1>
                <p style={{ margin: 0, color: heroDark ? 'rgba(248,250,252,0.78)' : tokens.color.mutedStrong, lineHeight: 1.75 }}>{description}</p>
              </div>
            </div>
            <div style={{ minWidth: 220, display: 'grid', gap: 10 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: heroDark ? 'rgba(248,250,252,0.62)' : tokens.color.muted }}>Atualizado agora</div>
              </div>
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 18,
                  background: heroDark ? 'rgba(255,255,255,0.1)' : `${accentColor}10`,
                  border: heroDark ? '1px solid rgba(255,255,255,0.16)' : `1px solid ${accentColor}20`,
                }}
              >
                <strong style={{ display: 'block', fontSize: 14, color: heroDark ? '#f8fafc' : tokens.color.shell }}>{asideTitle}</strong>
                <span style={{ display: 'block', marginTop: 6, lineHeight: 1.6, color: heroDark ? 'rgba(248,250,252,0.78)' : tokens.color.mutedStrong }}>{asideTone}</span>
              </div>
            </div>
          </div>

          {!!metrics?.length && <MetricRow items={metrics} dark={metricDark} />}
        </div>
      </div>

      {highlightVariant === 'pills' || highlightVariant === 'chips' ? null : highlightNode}

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: bodyColumns }}>
        {reversePanels ? recordsPanel : formPanel}
        {reversePanels ? formPanel : recordsPanel}
      </div>
    </section>
  )
}

export function SurfaceCard({
  title,
  description,
  meta,
  children,
}: {
  title: string
  description?: string
  meta?: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: tokens.radius.card,
        background: '#ffffff',
        border: `1px solid ${tokens.color.border}`,
        boxShadow: tokens.shadow.panel,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start', marginBottom: 18 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.08, letterSpacing: '-0.03em', color: tokens.color.shell }}>{title}</h2>
          {description ?<p style={{ margin: 0, color: tokens.color.mutedStrong, lineHeight: 1.6 }}>{description}</p> : null}
        </div>
        {meta ?<Badge subtle>{meta}</Badge> : null}
      </div>
      {children}
    </div>
  )
}

export function MetricRow({
  items,
  dark = false,
}: {
  items: Array<{ label: string; value: string }>
  dark?: boolean
}) {
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            padding: '16px 18px',
            borderRadius: 14,
            background: dark ?'rgba(255,255,255,0.08)' : '#ffffff',
            border: dark ?'1px solid rgba(255,255,255,0.12)' : `1px solid ${tokens.color.border}`,
            boxShadow: dark ?'none' : tokens.shadow.panel,
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: dark ?'rgba(248,250,252,0.66)' : tokens.color.muted, fontWeight: 800 }}>
            {item.label}
          </div>
          <strong style={{ display: 'block', marginTop: 8, fontSize: 24, color: dark ?'#f8fafc' : tokens.color.shell }}>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function Badge({
  children,
  dark = false,
  subtle = false,
}: {
  children: ReactNode
  dark?: boolean
  subtle?: boolean
}) {
  const style: CSSProperties = {
    display: 'inline-flex',
    width: 'fit-content',
    padding: '7px 12px',
    borderRadius: tokens.color.accentSoft ?tokens.radius.pill : 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  }

  if (dark) {
    return <span style={{ ...style, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.16)', color: '#f8fafc' }}>{children}</span>
  }

  if (subtle) {
    return <span style={{ ...style, background: tokens.color.accentSoft, color: tokens.color.accentStrong }}>{children}</span>
  }

  return <span style={{ ...style, background: tokens.color.accentSoft, color: tokens.color.accentStrong }}>{children}</span>
}

export function FieldGroup({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontWeight: 800, fontSize: 14, color: tokens.color.shell }}>{label}</span>
      {children}
      {hint ?<small style={{ color: tokens.color.muted, fontSize: 13, lineHeight: 1.5 }}>{hint}</small> : null}
    </label>
  )
}

export function inputStyle(overrides: CSSProperties = {}): CSSProperties {
  return {
    width: '100%',
    padding: '13px 14px',
    borderRadius: tokens.radius.control,
    border: `1px solid ${tokens.color.border}`,
    background: '#ffffff',
    color: tokens.color.text,
    fontSize: 14,
    boxSizing: 'border-box',
    outline: 'none',
    ...overrides,
  }
}

export function PrimaryButton({
  children,
  accent = 'teal',
  type = 'button',
}: {
  children: ReactNode
  accent?: 'teal' | 'blue' | 'violet' | 'amber'
  type?: 'button' | 'submit'
}) {
  const colorByAccent: Record<string, string> = {
    teal: '#0f766e',
    blue: '#2451b7',
    violet: '#6d28d9',
    amber: '#b45309',
  }

  return (
    <button
      type={type}
      style={{
        padding: '13px 16px',
        borderRadius: tokens.radius.control,
        border: 'none',
        background: colorByAccent[accent] || colorByAccent.teal,
        color: '#ffffff',
        fontWeight: 800,
        fontSize: 14,
        cursor: 'pointer',
        boxShadow: '0 12px 24px rgba(37, 81, 183, 0.18)',
      }}
    >
      {children}
    </button>
  )
}
