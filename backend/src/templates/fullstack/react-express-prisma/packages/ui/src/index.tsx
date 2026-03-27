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
                color: active ? tokens.color.shell : tokens.color.mutedStrong,
                fontWeight: active ? 800 : 600,
                background: active ? '#eef2ff' : 'transparent',
                borderLeft: active ? `3px solid ${tokens.color.accent}` : '3px solid transparent',
                borderBottom: `1px solid ${tokens.color.shellBorder}`,
              }}
            >
              {route.label}
            </a>
          )
        })}
      </nav>

      <div style={{ marginTop: 'auto', padding: 16, fontSize: 12, color: tokens.color.muted }}>
        Workspace pronto para evolucao incremental.
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
            Estrutura base pronta para evoluir modulos operacionais, fluxos de cadastro e jornadas de acompanhamento com mais consistencia.
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: tokens.color.muted, fontWeight: 700 }}>Ultima atualizacao</div>
          <strong style={{ display: 'block', marginTop: 6, color: tokens.color.shell }}>Agora</strong>
        </div>
      </div>

      <MetricRow
        items={[
          { label: 'Modulos ativos', value: String(routes.length) },
          { label: 'Navegacao', value: 'Pronta' },
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

export function FeaturePage({
  accent = 'teal',
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
  layout?: 'split' | 'stacked' | 'wizard' | 'dashboard'
  eyebrow: string
  title: string
  description: string
  metrics: Array<{ label: string; value: string }>
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
            <div style={{ fontSize: 12, color: tokens.color.muted, fontWeight: 700 }}>Ultima atualização</div>
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
              {highlights[0] || 'Fluxo pronto para operacao com mais clareza.'}
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
          {description ? <p style={{ margin: 0, color: tokens.color.mutedStrong, lineHeight: 1.6 }}>{description}</p> : null}
        </div>
        {meta ? <Badge subtle>{meta}</Badge> : null}
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
            background: dark ? 'rgba(255,255,255,0.08)' : '#ffffff',
            border: dark ? '1px solid rgba(255,255,255,0.12)' : `1px solid ${tokens.color.border}`,
            boxShadow: dark ? 'none' : tokens.shadow.panel,
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: dark ? 'rgba(248,250,252,0.66)' : tokens.color.muted, fontWeight: 800 }}>
            {item.label}
          </div>
          <strong style={{ display: 'block', marginTop: 8, fontSize: 24, color: dark ? '#f8fafc' : tokens.color.shell }}>{item.value}</strong>
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
    borderRadius: tokens.color.accentSoft ? tokens.radius.pill : 999,
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
      {hint ? <small style={{ color: tokens.color.muted, fontSize: 13, lineHeight: 1.5 }}>{hint}</small> : null}
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
