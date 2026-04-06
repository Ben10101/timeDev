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
    panel: '0 18px 46px rgba(15, 23, 42, 0.08)',
    header: '0 18px 40px rgba(8, 15, 32, 0.28)',
  },
}

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(138, 180, 248, 0.18), transparent 24%), radial-gradient(circle at top right, rgba(49, 129, 255, 0.14), transparent 18%), linear-gradient(180deg, #edf3ff 0%, #f6f8fc 34%, #eef2f8 100%)',
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
        height: 64,
        padding: '0 22px',
        background: 'linear-gradient(135deg, #1f2447 0%, #28315f 58%, #202a54 100%)',
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
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 12,
            display: 'grid',
            alignContent: 'center',
            gap: 4,
            padding: '0 8px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
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
        width: 252,
        minHeight: 'calc(100vh - 64px)',
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(16px)',
        borderRight: '1px solid rgba(215,220,237,0.9)',
        display: 'grid',
        alignContent: 'start',
      }}
    >
      <div style={{ padding: '22px 18px 14px', borderBottom: `1px solid ${tokens.color.shellBorder}` }}>
        <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 800 }}>
          Navegação
        </div>
      </div>

      <nav style={{ display: 'grid', gap: 8, padding: 12 }}>
        {routes.map((route) => {
          const active = activePath === route.path
          return (
            <a
              key={route.path}
              href={route.path}
              style={{
                padding: '14px 16px',
                textDecoration: 'none',
                color: active ? tokens.color.shell : tokens.color.mutedStrong,
                fontWeight: active ? 800 : 700,
                background: active ? 'linear-gradient(135deg, #e7eeff 0%, #f3f6ff 100%)' : 'transparent',
                border: active ? `1px solid ${tokens.color.accentSoft}` : '1px solid transparent',
                borderRadius: 16,
                boxShadow: active ? '0 10px 24px rgba(36, 81, 183, 0.12)' : 'none',
              }}
            >
              {route.label}
            </a>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: 18, fontSize: 12, color: tokens.color.muted }}>
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
        borderRadius: 28,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.94) 0%, rgba(248,250,255,0.98) 100%)',
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
          <div style={{ fontSize: 12, color: tokens.color.muted, fontWeight: 700 }}>?ltima atualização</div>
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
              borderRadius: 18,
              textDecoration: 'none',
              color: tokens.color.text,
              background: 'linear-gradient(135deg, #ffffff 0%, #f6f8ff 100%)',
              border: `1px solid ${tokens.color.border}`,
              boxShadow: '0 14px 28px rgba(31, 42, 68, 0.06)',
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

function getLayoutVariantOverrides(layoutVariant: string) {
  const overrides: Record<string, Record<string, unknown>> = {
    'balanced-split': {},
    'hero-metrics': {
      reversePanels: true,
      bodyColumns: 'minmax(0, 1.14fr) minmax(360px, 0.86fr)',
      highlightVariant: 'cards',
      recordsVariant: 'insights',
    },
    'queue-first': {
      reversePanels: true,
      bodyColumns: 'minmax(0, 1.08fr) minmax(360px, 0.92fr)',
      highlightVariant: 'cards',
      recordsVariant: 'queue',
    },
    'queue-priority': {
      reversePanels: true,
      bodyColumns: 'minmax(0, 1.08fr) minmax(360px, 0.92fr)',
      highlightVariant: 'cards',
      recordsVariant: 'queue',
    },
    'evidence-split': {
      reversePanels: true,
      bodyColumns: 'minmax(0, 1.12fr) minmax(360px, 0.88fr)',
      highlightVariant: 'chips',
      recordsVariant: 'evidence',
    },
    'guided-stack': {
      reversePanels: false,
      bodyColumns: 'minmax(0, 1fr)',
      highlightVariant: 'steps',
      recordsVariant: 'steps',
    },
    'calm-settings': {
      settingsColumns: 'minmax(0, 1.08fr) minmax(320px, 0.92fr)',
      settingsReverse: false,
      settingsHighlightTitle: 'Boas praticas',
    },
    'summary-first': {
      settingsColumns: 'minmax(320px, 0.9fr) minmax(0, 1.1fr)',
      settingsReverse: true,
      settingsHighlightTitle: 'Leituras rapidas',
    },
    'checklist-settings': {
      settingsColumns: 'minmax(320px, 0.88fr) minmax(0, 1.12fr)',
      settingsReverse: true,
      settingsHighlightTitle: 'Checklist de governanca',
    },
  }

  return overrides[layoutVariant] || overrides['balanced-split']
}

function getArchetypeOverrides(pageArchetype: string, fallbackPattern: string, patternHints: string[] = []) {
  const joinedHints = patternHints.join(' ')
  const overrides: Record<string, Record<string, unknown>> = {
    'executive-dashboard': {
      heroDark: true,
      metricDark: true,
      reversePanels: true,
      bodyColumns: 'minmax(0, 1.16fr) minmax(360px, 0.84fr)',
      highlightVariant: 'cards',
      recordsVariant: 'insights',
      asideTitle: 'Painel em foco',
      asideTone: 'Compare sinais, enxergue gargalos e tome decisao com contexto logo no primeiro olhar.',
      searchLabel: 'Filtrar indicador, fila ou recorte',
      tableLabels: ['Indicador', 'Status', 'Leitura'],
    },
    'operations-queue': {
      reversePanels: true,
      bodyColumns: 'minmax(0, 1.12fr) minmax(360px, 0.88fr)',
      highlightVariant: 'cards',
      recordsVariant: 'queue',
      asideTitle: 'Fila operacional',
      asideTone: 'Deixe prioridade, dono e proximo passo visiveis para a fila continuar fluindo.',
      searchLabel: 'Buscar item por prioridade, dono ou fila',
      tableLabels: ['Item', 'Prioridade', 'Atualizacao'],
    },
    'review-queue': {
      reversePanels: true,
      bodyColumns: 'minmax(0, 1.1fr) minmax(360px, 0.9fr)',
      highlightVariant: 'cards',
      recordsVariant: 'queue',
      asideTitle: 'Decisao em andamento',
      asideTone: 'Mostre o que precisa de parecer agora e preserve contexto para revisar rapido.',
      searchLabel: 'Buscar item para revisar',
      tableLabels: ['Item', 'Decisao', 'Atualizacao'],
    },
    'approval-flow': {
      reversePanels: false,
      bodyColumns: 'minmax(0, 1fr)',
      highlightVariant: 'steps',
      recordsVariant: 'steps',
      asideTitle: 'Fluxo de aprovacao',
      asideTone: 'Deixe criterios, etapas e checkpoints explicitos para reduzir friccao na decisao.',
    },
    'evidence-workbench': {
      reversePanels: true,
      bodyColumns: 'minmax(0, 1.12fr) minmax(360px, 0.88fr)',
      highlightVariant: 'chips',
      recordsVariant: 'evidence',
      asideTitle: 'Mesa de evidencias',
      asideTone: 'Organize anexos, contexto e comprovacoes com leitura rapida para quem investiga o caso.',
      searchLabel: 'Buscar comprovante, arquivo ou referencia',
      tableLabels: ['Evidencia', 'Status', 'Envio'],
    },
    'settings-console': {
      settingsColumns: 'minmax(320px, 0.88fr) minmax(0, 1.12fr)',
      settingsReverse: true,
      settingsHighlightTitle: 'Leituras de governanca',
    },
    'intake-form': {
      highlightVariant: 'soft-list',
      recordsVariant: 'summary',
      asideTitle: 'Contexto do cadastro',
      asideTone: 'Ajude quem preenche a enviar a informacao certa de primeira, sem ruido operacional.',
    },
    'record-management': {
      highlightVariant: 'cards',
      recordsVariant: 'table',
      asideTitle: 'Gestao em foco',
      asideTone: 'Combine cadastro, leitura e acompanhamento sem perder clareza sobre o estado atual.',
    },
  }

  const patternOverrides: Record<string, Record<string, unknown>> = {
    'vercel-analytics': {
      heroDark: true,
      metricDark: true,
      highlightVariant: 'cards',
      recordsVariant: 'insights',
    },
    'linear-queue': {
      reversePanels: true,
      highlightVariant: 'cards',
      recordsVariant: 'queue',
    },
    'stripe-settings': {
      settingsColumns: 'minmax(320px, 0.9fr) minmax(0, 1.1fr)',
      settingsReverse: true,
      settingsHighlightTitle: 'Resumo rapido',
    },
    'github-review': {
      highlightVariant: 'steps',
      recordsVariant: 'steps',
      reversePanels: false,
      bodyColumns: 'minmax(0, 1fr)',
    },
    'notion-evidence': {
      highlightVariant: 'chips',
      recordsVariant: 'evidence',
      reversePanels: true,
    },
  }

  return {
    ...(overrides[pageArchetype] || {}),
    ...(patternOverrides[fallbackPattern] || {}),
    ...(joinedHints.includes('priority-visible') ? { searchLabel: 'Buscar por prioridade, dono ou estado' } : {}),
    ...(joinedHints.includes('decision-focused') ? { highlightVariant: 'steps', recordsVariant: 'steps' } : {}),
    ...(joinedHints.includes('summary-before-secondary-actions')
      ? { settingsColumns: 'minmax(320px, 0.9fr) minmax(0, 1.1fr)', settingsReverse: true }
      : {}),
    ...(joinedHints.includes('workflow-guided') && pageArchetype !== 'approval-flow'
      ? { asideTone: 'A tela deve mostrar claramente o proximo passo para a operacao continuar andando.' }
      : {}),
  }
}

function buildSectionSet(sections: string[] = [], fallback: string[] = []) {
  return new Set((Array.isArray(sections) && sections.length ? sections : fallback).filter(Boolean))
}

function hasSection(sectionSet: Set<string>, section: string) {
  return sectionSet.has(section)
}

type ComponentMap = {
  recordsLead?: string | null
  activity?: string | null
  summary?: string | null
  highlights?: string | null
}

function getUiIntentProfile(uiIntent: string) {
  const profiles: Record<string, Record<string, string>> = {
    configure: {
      badge: 'Ajuste principal',
      summaryTitle: 'Estado da configuracao',
      summaryTone: 'Ajuste preferencia, confira o estado atual e siga com clareza.',
    },
    attach: {
      badge: 'Captura principal',
      summaryTitle: 'Contexto do envio',
      summaryTone: 'Anexe arquivos com contexto suficiente para facilitar a leitura do caso.',
    },
    review: {
      badge: 'Decisao principal',
      summaryTitle: 'Fila em foco',
      summaryTone: 'Veja o que precisa de decisao agora e mantenha a fila sob controle.',
    },
    monitor: {
      badge: 'Leitura principal',
      summaryTitle: 'Visao executiva',
      summaryTone: 'Consolide sinais, compare recortes e acompanhe o que merece atencao.',
    },
    create: {
      badge: 'Cadastro principal',
      summaryTitle: 'Contexto do registro',
      summaryTone: 'Registre com contexto suficiente para que o item ja nasca util.',
    },
    update: {
      badge: 'Atualizacao principal',
      summaryTitle: 'Resumo atual',
      summaryTone: 'Atualize o que importa e mantenha clareza sobre o estado atual.',
    },
    list: {
      badge: 'Consulta principal',
      summaryTitle: 'Leitura atual',
      summaryTone: 'Filtre, encontre e avance rapidamente sobre o que precisa de atencao.',
    },
  }

  return {
    badge: 'Fluxo principal',
    summaryTitle: 'Resumo da tela',
    summaryTone: 'Entenda rapidamente o que esta pagina ajuda a concluir.',
    ...(profiles[uiIntent] || {}),
  }
}

function IntentSignal({
  badge,
  title,
  tone,
  accentColor,
}: {
  badge: string
  title: string
  tone: string
  accentColor: string
}) {
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 18,
        background: '#ffffff',
        border: `1px solid ${accentColor}22`,
        boxShadow: tokens.shadow.panel,
      }}
    >
      <div style={{ fontSize: 12, color: tokens.color.muted, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{badge}</div>
      <strong style={{ display: 'block', marginTop: 8, color: tokens.color.shell, fontSize: 15 }}>{title}</strong>
      <p style={{ margin: '8px 0 0', color: tokens.color.mutedStrong, lineHeight: 1.6 }}>{tone}</p>
    </div>
  )
}

function SettingsSnapshot({ items }: { items: string[] }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map((item) => (
        <div
          key={item}
          style={{
            padding: '12px 14px',
            borderRadius: 14,
            background: '#f8fafc',
            border: `1px solid ${tokens.color.border}`,
            color: tokens.color.mutedStrong,
            lineHeight: 1.6,
          }}
        >
          {item}
        </div>
      ))}
    </div>
  )
}

function EvidenceRail({ accentColor }: { accentColor: string }) {
  return (
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
      Organize comprovantes, links e anexos em uma trilha clara para quem vai analisar o caso.
    </div>
  )
}

function ReviewQueuePreview() {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {['Precisa de validacao', 'Em revisao', 'Pronto para decidir'].map((item) => (
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
  )
}

function ApprovalStepsPreview({ accentColor }: { accentColor: string }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {[
        ['Preparar contexto', 'Reunir evidencias e criterio de decisao.'],
        ['Revisar impacto', 'Validar risco, escopo e responsavel.'],
        ['Concluir parecer', 'Registrar a decisao e proximo passo.'],
      ].map(([title, tone], index) => (
        <div key={title} style={{ display: 'grid', gridTemplateColumns: '24px 1fr', gap: 12, alignItems: 'start' }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: `${accentColor}15`,
              color: accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 11,
            }}
          >
            {index + 1}
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <strong style={{ color: tokens.color.shell, fontSize: 14 }}>{title}</strong>
            <span style={{ color: tokens.color.mutedStrong, lineHeight: 1.6 }}>{tone}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ActivityTimeline({ items }: { items?: string[] }) {
  const timelineItems = items?.length
    ? items
    : [
        'Mudanca mais recente registrada nesta area.',
        'Ultimo ajuste validado pela operacao.',
        'Proximo evento aguardando acompanhamento.',
      ]

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {timelineItems.slice(0, 3).map((item, index) => (
        <div key={`${item}-${index}`} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 12, alignItems: 'start' }}>
          <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: tokens.color.accent }} />
            {index < Math.min(timelineItems.length, 3) - 1 ? <span style={{ width: 2, minHeight: 28, borderRadius: 999, background: tokens.color.border }} /> : null}
          </div>
          <div
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
        </div>
      ))}
    </div>
  )
}

function InsightStrip({ labels }: { labels: string[] }) {
  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
      {labels.map((label) => (
        <div
          key={label}
          style={{
            padding: '12px 14px',
            borderRadius: 14,
            background: '#111827',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.72, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
          <div style={{ marginTop: 8, fontWeight: 800 }}>Acompanhando</div>
        </div>
      ))}
    </div>
  )
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

function getWorkbenchVisualTokens(productMode: string, accentColor: string) {
  const presets: Record<string, Record<string, string>> = {
    'governance-console': {
      heroBackground: 'linear-gradient(135deg, #1f274d 0%, #2d396d 100%)',
      canvasBackground: 'linear-gradient(180deg, rgba(22,34,66,0.04) 0%, rgba(255,255,255,0.42) 100%)',
      formBackground: '#f7f9ff',
      recordsBackground: '#ffffff',
      leadBackground: '#eef3ff',
    },
    'self-service-settings': {
      heroBackground: 'linear-gradient(135deg, #ffffff 0%, #f5f8ff 100%)',
      canvasBackground: 'linear-gradient(180deg, rgba(36,81,183,0.05) 0%, rgba(255,255,255,0.4) 100%)',
      formBackground: '#ffffff',
      recordsBackground: '#fbfcff',
      leadBackground: '#f3f7ff',
    },
    'evidence-workbench': {
      heroBackground: 'linear-gradient(135deg, #f4fffb 0%, #ffffff 54%, #edf8ff 100%)',
      canvasBackground: 'linear-gradient(180deg, rgba(15,118,110,0.06) 0%, rgba(255,255,255,0.42) 100%)',
      formBackground: '#f7fffd',
      recordsBackground: '#fcfffe',
      leadBackground: '#edf8f6',
    },
    'manager-cockpit': {
      heroBackground: 'linear-gradient(135deg, #1f2447 0%, #2d3d77 62%, #1f5ba8 100%)',
      canvasBackground: 'linear-gradient(180deg, rgba(36,81,183,0.08) 0%, rgba(255,255,255,0.4) 100%)',
      formBackground: '#f8faff',
      recordsBackground: '#ffffff',
      leadBackground: '#eef4ff',
    },
  }
  return (
    presets[productMode] || {
      heroBackground: `linear-gradient(135deg, ${accentColor}12 0%, #ffffff 54%, #f5f8ff 100%)`,
      canvasBackground: 'linear-gradient(180deg, rgba(36,81,183,0.05) 0%, rgba(255,255,255,0.4) 100%)',
      formBackground: '#ffffff',
      recordsBackground: '#ffffff',
      leadBackground: '#f5f8ff',
    }
  )
}

export function FeatureWorkbench({
  accent = 'teal',
  productMode = 'structured-workspace',
  uiIntent = 'custom',
  layoutVariant = 'balanced-split',
  pageArchetype = 'record-management',
  fallbackPattern = 'stripe-records',
  patternHints = [],
  sections = [],
  componentMap = {},
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
  uiIntent?: string
  layoutVariant?: string
  pageArchetype?: string
  fallbackPattern?: string
  patternHints?: string[]
  sections?: string[]
  componentMap?: ComponentMap
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
  const layoutOverrides = getLayoutVariantOverrides(layoutVariant)
  const archetypeOverrides = getArchetypeOverrides(pageArchetype, fallbackPattern, patternHints)
  const heroDark = Boolean(archetypeOverrides.heroDark ?? modeProfile.heroDark)
  const metricDark = Boolean(archetypeOverrides.metricDark ?? modeProfile.metricDark)
  const reversePanels = Boolean(archetypeOverrides.reversePanels ?? layoutOverrides.reversePanels ?? modeProfile.reversePanels)
  const bodyColumns = String(archetypeOverrides.bodyColumns || layoutOverrides.bodyColumns || modeProfile.bodyColumns || 'minmax(340px, 420px) minmax(0, 1fr)')
  const searchLabel = String(archetypeOverrides.searchLabel || modeProfile.searchLabel || 'Pesquisar...')
  const tableLabels = Array.isArray(archetypeOverrides.tableLabels)
    ? archetypeOverrides.tableLabels
    : Array.isArray(modeProfile.tableLabels)
      ? modeProfile.tableLabels
      : ['Registro', 'Status', 'Atualizacao']
  const asideTitle = String(archetypeOverrides.asideTitle || modeProfile.asideTitle || 'Operacao viva')
  const asideTone = String(archetypeOverrides.asideTone || modeProfile.asideTone || 'Acompanhe o contexto principal desta area sem perder clareza.')
  const intentProfile = getUiIntentProfile(uiIntent)
  const highlightVariant = String(archetypeOverrides.highlightVariant || layoutOverrides.highlightVariant || modeProfile.highlightVariant || 'cards')
  const recordsVariant = String(archetypeOverrides.recordsVariant || layoutOverrides.recordsVariant || modeProfile.recordsVariant || 'table')
  const formVariant = String(modeProfile.formVariant || 'panel')
  const visuals = getWorkbenchVisualTokens(productMode, accentColor)
  const sectionSet = buildSectionSet(sections, ['hero', 'form', 'records'])
  const showHero = hasSection(sectionSet, 'hero')
  const showMetrics = hasSection(sectionSet, 'metrics') && Boolean(metrics?.length)
  const showIntentSignal = hasSection(sectionSet, 'summary') || hasSection(sectionSet, 'hero')
  const showFilters = hasSection(sectionSet, 'filters')
  const showForm = hasSection(sectionSet, 'form')
  const showRecords = hasSection(sectionSet, 'records') || hasSection(sectionSet, 'list') || hasSection(sectionSet, 'queue')
  const showActivity = hasSection(sectionSet, 'activity')
  const effectiveRecordsVariant = componentMap.recordsLead === 'approvalSteps'
    ? 'steps'
    : componentMap.recordsLead === 'queueRail'
      ? 'queue'
      : componentMap.recordsLead === 'evidenceRail'
        ? 'evidence'
        : componentMap.recordsLead === 'insightStrip'
          ? 'insights'
          : hasSection(sectionSet, 'steps')
    ? 'steps'
    : hasSection(sectionSet, 'queue')
      ? 'queue'
      : hasSection(sectionSet, 'metrics')
        ? 'insights'
        : hasSection(sectionSet, 'summary') && recordsVariant === 'table'
          ? 'summary'
          : recordsVariant

  const highlightNode =
    highlightVariant === 'pills' ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {highlights.map((item) => (
          <span
            key={item}
            style={{
              padding: '8px 11px',
              borderRadius: tokens.radius.pill,
              background: `${heroDark ? 'rgba(255,255,255,0.14)' : '#ffffff'}`,
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
              background: visuals.leadBackground,
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
              background: `${accentColor}10`,
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
    effectiveRecordsVariant === 'summary' ? (
      <SettingsSnapshot items={highlights.slice(0, 2)} />
    ) : effectiveRecordsVariant === 'policy-grid' ? (
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        {tableLabels.slice(0, 2).map((label) => (
          <div
            key={String(label)}
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              background: visuals.leadBackground,
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
    ) : effectiveRecordsVariant === 'evidence' ? (
      <EvidenceRail accentColor={accentColor} />
    ) : effectiveRecordsVariant === 'insights' ? (
      <InsightStrip labels={tableLabels.map((label) => String(label))} />
    ) : effectiveRecordsVariant === 'queue' ? (
      <ReviewQueuePreview />
    ) : effectiveRecordsVariant === 'steps' ? (
      <ApprovalStepsPreview accentColor={accentColor} />
    ) : null

  const formPanel = (
    <SurfaceCard title={formTitle} description={formDescription} background={visuals.formBackground}>
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
        {showActivity || componentMap.activity === 'activityTimeline' ? <ActivityTimeline /> : null}
      </div>
    </SurfaceCard>
  )

  const recordsPanel = (
    <SurfaceCard title={listTitle} description={listDescription} meta={listMeta} background={visuals.recordsBackground}>
      <div style={{ display: 'grid', gap: 14 }}>
        {recordsLeadNode}
        {showFilters && effectiveRecordsVariant !== 'summary' && effectiveRecordsVariant !== 'steps' ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 14,
              background: visuals.leadBackground,
              border: `1px solid ${tokens.color.border}`,
            }}
          >
            <span style={{ color: tokens.color.muted }}>Buscar</span>
            <span style={{ color: tokens.color.mutedStrong }}>{searchLabel}</span>
          </div>
        ) : null}
        {showFilters && effectiveRecordsVariant !== 'summary' && effectiveRecordsVariant !== 'steps' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.3fr 0.8fr 0.9fr',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 12,
              background: visuals.leadBackground,
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
      {showHero ? (
        <div
          style={{
            padding: '22px 24px',
            borderRadius: 24,
            background: heroDark ? `linear-gradient(135deg, ${tokens.color.shell} 0%, ${tokens.color.shellSoft} 100%)` : visuals.heroBackground,
            border: heroDark ? 'none' : `1px solid ${tokens.color.border}`,
            boxShadow: tokens.shadow.panel,
            color: heroDark ? '#f8fafc' : tokens.color.text,
          }}
        >
          <div style={{ display: 'grid', gap: 18, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -36, right: -28, width: 180, height: 180, borderRadius: '50%', background: heroDark ? 'rgba(255,255,255,0.07)' : `${accentColor}10`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -54, right: 132, width: 128, height: 128, borderRadius: 32, background: heroDark ? 'rgba(255,255,255,0.05)' : `${accentColor}14`, transform: 'rotate(18deg)', pointerEvents: 'none' }} />
            {showIntentSignal ? (
              <IntentSignal
                badge={intentProfile.badge}
                title={intentProfile.summaryTitle}
                tone={intentProfile.summaryTone}
                accentColor={accentColor}
              />
            ) : null}
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

            {showMetrics ? <MetricRow items={metrics} dark={metricDark} /> : null}
          </div>
        </div>
      ) : null}

      {showForm || showRecords ? (
        <>
          {highlightVariant === 'pills' || highlightVariant === 'chips' ? null : highlightNode}
          <div style={{ display: 'grid', gap: 18, gridTemplateColumns: bodyColumns, padding: 6, borderRadius: 28, background: visuals.canvasBackground }}>
            {showRecords && showForm ? (
              <>
                {reversePanels ? recordsPanel : formPanel}
                {reversePanels ? formPanel : recordsPanel}
              </>
            ) : showForm ? (
              formPanel
            ) : (
              recordsPanel
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}

export function SettingsWorkbench({
  accent = 'teal',
  productMode = 'self-service-settings',
  uiIntent = 'configure',
  layoutVariant = 'calm-settings',
  pageArchetype = 'settings-console',
  fallbackPattern = 'stripe-settings',
  patternHints = [],
  sections = [],
  componentMap = {},
  eyebrow,
  title,
  description,
  highlights,
  formTitle,
  formDescription,
  form,
  summaryTitle,
  summaryDescription,
  summaryMeta,
  summaryHighlights,
  children,
}: {
  accent?: 'teal' | 'blue' | 'violet' | 'amber'
  productMode?: string
  uiIntent?: string
  layoutVariant?: string
  pageArchetype?: string
  fallbackPattern?: string
  patternHints?: string[]
  sections?: string[]
  componentMap?: ComponentMap
  eyebrow: string
  title: string
  description: string
  highlights: string[]
  formTitle: string
  formDescription: string
  form: ReactNode
  summaryTitle: string
  summaryDescription: string
  summaryMeta?: string
  summaryHighlights?: string[]
  children: ReactNode
}) {
  const accentMap: Record<string, string> = {
    teal: '#0f766e',
    blue: '#2451b7',
    violet: '#6d28d9',
    amber: '#b45309',
  }

  const accentColor = accentMap[accent] || accentMap.teal
  const intentProfile = getUiIntentProfile(uiIntent)
  const modeProfile = getFeatureModeProfile(productMode)
  const layoutOverrides = getLayoutVariantOverrides(layoutVariant)
  const archetypeOverrides = getArchetypeOverrides(pageArchetype, fallbackPattern, patternHints)
  const asideTone = String(modeProfile.asideTone || 'Ajustes simples e claros para manter o controle do que esta ativo.')
  const summaryItems = (summaryHighlights?.length ? summaryHighlights : highlights).slice(0, 3)
  const visuals = getWorkbenchVisualTokens(productMode, accentColor)
  const settingsColumns = String(archetypeOverrides.settingsColumns || layoutOverrides.settingsColumns || 'minmax(0, 1.08fr) minmax(320px, 0.92fr)')
  const settingsReverse = Boolean(archetypeOverrides.settingsReverse ?? layoutOverrides.settingsReverse)
  const settingsHighlightTitle = String(archetypeOverrides.settingsHighlightTitle || layoutOverrides.settingsHighlightTitle || 'Boas praticas')
  const sectionSet = buildSectionSet(sections, ['hero', 'form', 'summary'])
  const showHero = hasSection(sectionSet, 'hero')
  const showSummary = hasSection(sectionSet, 'summary')
  const showActivity = hasSection(sectionSet, 'activity')
  const formPanel = (
    <SurfaceCard title={formTitle} description={formDescription} background={visuals.formBackground}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div
          style={{
            padding: '16px 18px',
            borderRadius: 18,
            background: visuals.leadBackground,
            border: `1px solid ${tokens.color.border}`,
            display: 'grid',
            gap: 10,
          }}
        >
          <strong style={{ color: tokens.color.shell, fontSize: 15 }}>{summaryTitle}</strong>
          <p style={{ margin: 0, color: tokens.color.mutedStrong, lineHeight: 1.7 }}>{asideTone}</p>
        </div>
        {form}
      </div>
    </SurfaceCard>
  )
  const summaryPanel = (
    <div style={{ display: 'grid', gap: 16 }}>
          {showSummary || componentMap.summary === 'settingsSnapshot' ? (
            <SurfaceCard title={summaryTitle} description={summaryDescription} meta={summaryMeta} background={visuals.recordsBackground}>
          <div style={{ display: 'grid', gap: 14 }}>
            <SettingsSnapshot items={summaryItems} />
            {children}
          </div>
        </SurfaceCard>
      ) : null}
      {highlights.length ? (
        <SurfaceCard title={settingsHighlightTitle} description="Pontos de atencao para manter este ajuste claro para o usuario." background={visuals.recordsBackground}>
          <div style={{ display: 'grid', gap: 10 }}>
            {highlights.map((item) => (
              <div
                key={item}
                style={{
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: visuals.leadBackground,
                  border: `1px solid ${tokens.color.border}`,
                  color: tokens.color.mutedStrong,
                  lineHeight: 1.6,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </SurfaceCard>
      ) : null}
          {showActivity || componentMap.activity === 'activityTimeline' ? (
            <SurfaceCard title="Atividade recente" description="Sinais recentes para acompanhar o impacto dessas configuracoes." background={visuals.recordsBackground}>
              <ActivityTimeline />
            </SurfaceCard>
      ) : null}
    </div>
  )

  return (
    <section style={{ display: 'grid', gap: 20 }}>
      {showHero ? (
        <div
          style={{
            padding: '22px 24px',
            borderRadius: 24,
            background: visuals.heroBackground,
            border: `1px solid ${tokens.color.border}`,
            boxShadow: tokens.shadow.panel,
          }}
        >
          <div style={{ display: 'grid', gap: 18, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -34, right: -30, width: 160, height: 160, borderRadius: '50%', background: `${accentColor}12`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -44, left: 36, width: 124, height: 124, borderRadius: 28, background: `${accentColor}10`, transform: 'rotate(16deg)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'start' }}>
              <div style={{ display: 'grid', gap: 10, maxWidth: 820 }}>
                <Badge subtle>{eyebrow}</Badge>
                <div style={{ display: 'grid', gap: 8 }}>
                  <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.02, letterSpacing: '-0.03em', color: tokens.color.shell }}>{title}</h1>
                  <p style={{ margin: 0, color: tokens.color.mutedStrong, lineHeight: 1.75 }}>{description}</p>
                </div>
              </div>
              <div style={{ minWidth: 240, display: 'grid', gap: 10 }}>
                <IntentSignal
                  badge={intentProfile.badge}
                  title={intentProfile.summaryTitle}
                  tone={intentProfile.summaryTone}
                  accentColor={accentColor}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: settingsColumns, padding: 6, borderRadius: 28, background: visuals.canvasBackground }}>
        {settingsReverse ? summaryPanel : formPanel}
        {settingsReverse ? formPanel : summaryPanel}
      </div>
    </section>
  )
}

export function SurfaceCard({
  title,
  description,
  meta,
  background = '#ffffff',
  children,
}: {
  title: string
  description?: string
  meta?: string
  background?: string
  children: ReactNode
}) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 22,
        background,
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
