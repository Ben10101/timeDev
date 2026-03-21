import type { CSSProperties, ReactNode } from 'react'

export const tokens = {
  color: {
    text: '#0f172a',
    muted: '#64748b',
    border: '#dbe4ee',
    surface: 'rgba(255,255,255,0.94)',
    surfaceAlt: '#f8fafc',
    accent: '#0f766e',
    accentStrong: '#134e4a',
    accentSoft: '#ccfbf1',
  },
  radius: {
    lg: 24,
    xl: 32,
    pill: 999,
  },
  shadow: {
    soft: '0 18px 50px rgba(15, 23, 42, 0.06)',
    strong: '0 32px 90px rgba(15, 23, 42, 0.22)',
  },
}

export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '24px 24px 48px',
        background:
          'radial-gradient(circle at top left, rgba(15, 118, 110, 0.08), transparent 28%), linear-gradient(180deg, #f8fafc 0%, #eef4f7 100%)',
        color: tokens.color.text,
        fontFamily: 'Inter, Segoe UI, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1220, margin: '0 auto', display: 'grid', gap: 24 }}>{children}</div>
    </main>
  )
}

export function AppHeader({
  title,
  routes,
  activePath,
}: {
  title: string
  activePath: string
  routes: Array<{ path: string; label: string }>
}) {
  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        padding: '16px 18px',
        borderRadius: tokens.radius.lg,
        background: 'rgba(255,255,255,0.82)',
        border: `1px solid ${tokens.color.border}`,
        boxShadow: tokens.shadow.soft,
        backdropFilter: 'blur(14px)',
        position: 'sticky',
        top: 16,
        zIndex: 10,
      }}
    >
      <div style={{ display: 'grid', gap: 4 }}>
        <span style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: tokens.color.muted, fontWeight: 700 }}>
          Application Studio
        </span>
        <strong style={{ fontSize: 22 }}>{title}</strong>
      </div>

      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
        {routes.map((route) => {
          const active = activePath === route.path
          return (
            <a
              key={route.path}
              href={route.path}
              style={{
                padding: '10px 14px',
                borderRadius: tokens.radius.pill,
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 14,
                color: active ? '#f8fafc' : '#334155',
                background: active ? 'linear-gradient(135deg, #0f766e, #14b8a6)' : '#f8fafc',
                border: active ? 'none' : `1px solid ${tokens.color.border}`,
                boxShadow: active ? '0 14px 30px rgba(20, 184, 166, 0.24)' : 'none',
              }}
            >
              {route.label}
            </a>
          )
        })}
      </nav>
    </header>
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
        gap: 28,
        padding: 36,
        borderRadius: tokens.radius.xl,
        background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 55%, #0f766e 100%)',
        color: '#f8fafc',
        boxShadow: tokens.shadow.strong,
      }}
    >
      <div style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
        <Badge>Painel inicial</Badge>
        <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1, letterSpacing: '-0.04em' }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.7, color: 'rgba(248, 250, 252, 0.82)' }}>
          Ambiente base gerado para evoluir o produto com rapidez, clareza e consistencia entre as jornadas principais.
        </p>
      </div>

      <MetricRow
        items={[
          { label: 'Modulos ativos', value: String(routes.length) },
          { label: 'Navegacao pronta', value: '100%' },
          { label: 'Base pronta', value: 'Web + API' },
        ]}
        dark
      />

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {routes.map((route) => (
          <a
            key={route.path}
            href={route.path}
            style={{
              padding: 20,
              borderRadius: 24,
              textDecoration: 'none',
              color: '#f8fafc',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <strong style={{ display: 'block', fontSize: 18 }}>{route.label}</strong>
            <span style={{ display: 'block', marginTop: 10, color: 'rgba(248,250,252,0.7)' }}>Abrir modulo</span>
          </a>
        ))}
      </div>
    </section>
  )
}

export function FeaturePage({
  accent = 'teal',
  layout = 'split',
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
  const gradientByAccent: Record<string, string> = {
    teal: 'linear-gradient(145deg, #0f172a 0%, #134e4a 100%)',
    blue: 'linear-gradient(145deg, #0f172a 0%, #1d4ed8 100%)',
    violet: 'linear-gradient(145deg, #1e1b4b 0%, #7c3aed 100%)',
    amber: 'linear-gradient(145deg, #451a03 0%, #d97706 100%)',
  }

  const gridTemplateByLayout: Record<string, string> = {
    split: 'minmax(0, 1.08fr) minmax(340px, 0.92fr)',
    stacked: '1fr',
    wizard: 'minmax(0, 1.15fr) minmax(300px, 0.85fr)',
    dashboard: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)',
  }

  return (
    <section style={{ minHeight: '100vh', padding: '16px 0 24px' }}>
      <div style={{ display: 'grid', gap: 32, gridTemplateColumns: gridTemplateByLayout[layout] || gridTemplateByLayout.split }}>
        <section
          style={{
            display: 'grid',
            gap: 24,
            alignContent: 'start',
            padding: 36,
            borderRadius: tokens.radius.xl,
            background: gradientByAccent[accent] || gradientByAccent.teal,
            color: '#f8fafc',
            boxShadow: tokens.shadow.strong,
          }}
        >
          <Badge dark>{eyebrow}</Badge>
          <div style={{ display: 'grid', gap: 14 }}>
            <h1 style={{ margin: 0, fontSize: 52, lineHeight: 1, letterSpacing: '-0.04em' }}>{title}</h1>
            <p style={{ margin: 0, fontSize: 18, lineHeight: 1.7, color: 'rgba(248, 250, 252, 0.82)', maxWidth: 620 }}>{description}</p>
          </div>
          <MetricRow items={metrics} dark />
          {layout === 'wizard' ? (
            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              {['Defina', 'Revise', 'Publique'].map((step, index) => (
                <div
                  key={step}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 18,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <div style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(248,250,252,0.66)' }}>
                    Etapa {index + 1}
                  </div>
                  <strong style={{ display: 'block', marginTop: 8 }}>{step}</strong>
                </div>
              ))}
            </div>
          ) : null}
          <div style={{ display: 'grid', gap: 12 }}>
            {highlights.map((item) => (
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
        </section>

        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          <SurfaceCard title={formTitle} description={formDescription}>
            {form}
          </SurfaceCard>
          <SurfaceCard title={listTitle} description={listDescription} meta={listMeta}>
            {children}
          </SurfaceCard>
        </div>
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
        padding: 28,
        borderRadius: 28,
        background: tokens.color.surface,
        border: `1px solid ${tokens.color.border}`,
        boxShadow: tokens.shadow.soft,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <h2 style={{ margin: 0, fontSize: 28, color: tokens.color.text }}>{title}</h2>
          {description ? <p style={{ margin: 0, color: tokens.color.muted, lineHeight: 1.6 }}>{description}</p> : null}
        </div>
        {meta ? <Badge subtle>{meta}</Badge> : null}
      </div>
      {children}
    </div>
  )
}

export function Badge({
  children,
}: {
  children: ReactNode
}) {
  const style: CSSProperties = {
    display: 'inline-flex',
    width: 'fit-content',
    padding: '8px 14px',
    borderRadius: tokens.radius.pill,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    background: tokens.color.accentSoft,
    color: tokens.color.accentStrong,
  }

  return <span style={style}>{children}</span>
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
      <span style={{ fontWeight: 600, color: tokens.color.text }}>{label}</span>
      {children}
      {hint ? <small style={{ color: tokens.color.muted, fontSize: 13, lineHeight: 1.5 }}>{hint}</small> : null}
    </label>
  )
}

export function inputStyle(overrides: CSSProperties = {}): CSSProperties {
  return {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 16,
    border: '1px solid #cbd5e1',
    background: '#f8fafc',
    color: '#0f172a',
    fontSize: 15,
    boxSizing: 'border-box',
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
  const gradientByAccent: Record<string, string> = {
    teal: 'linear-gradient(135deg, #0f766e, #14b8a6)',
    blue: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
    violet: 'linear-gradient(135deg, #7c3aed, #a855f7)',
    amber: 'linear-gradient(135deg, #d97706, #f59e0b)',
  }

  const shadowByAccent: Record<string, string> = {
    teal: '0 18px 36px rgba(20, 184, 166, 0.28)',
    blue: '0 18px 36px rgba(59, 130, 246, 0.28)',
    violet: '0 18px 36px rgba(168, 85, 247, 0.26)',
    amber: '0 18px 36px rgba(245, 158, 11, 0.28)',
  }

  return (
    <button
      type={type}
      style={{
        padding: '15px 18px',
        borderRadius: 16,
        border: 'none',
        background: gradientByAccent[accent] || gradientByAccent.teal,
        color: '#fff',
        fontWeight: 700,
        fontSize: 15,
        cursor: 'pointer',
        boxShadow: shadowByAccent[accent] || shadowByAccent.teal,
      }}
    >
      {children}
    </button>
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
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item) => (
        <div
          key={item.label}
          style={{
            padding: 18,
            borderRadius: 22,
            background: dark ? 'rgba(255,255,255,0.08)' : '#f8fafc',
            border: dark ? '1px solid rgba(255,255,255,0.12)' : `1px solid ${tokens.color.border}`,
          }}
        >
          <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: dark ? 'rgba(248,250,252,0.66)' : tokens.color.muted }}>
            {item.label}
          </div>
          <strong style={{ display: 'block', marginTop: 10, fontSize: 28 }}>{item.value}</strong>
        </div>
      ))}
    </div>
  )
}
