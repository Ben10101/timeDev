import { ProfileSettingsPage } from './features/profile-settings/index'
import { CourseCatalogPage } from './features/course-catalog/index'
import { CourseModulesPage } from './features/course-modules/index'
import { CourseLessonsPage } from './features/course-lessons/index'
import { LessonMaterialsPage } from './features/lesson-materials/index'

const routes = [
  { path: '/', label: 'Inicio', render: () => <HomePage /> },
  { path: '/profile', label: 'Perfil', render: () => <ProfileSettingsPage /> },
  { path: '/courses', label: 'Cursos', render: () => <CourseCatalogPage /> },
  { path: '/courses/modules', label: 'Modulos', render: () => <CourseModulesPage /> },
  { path: '/courses/lessons', label: 'Aulas', render: () => <CourseLessonsPage /> },
  { path: '/courses/materials', label: 'Materiais', render: () => <LessonMaterialsPage /> },
]

function HomePage() {
  const productAreas = routes.filter((route) => route.path !== '/')

  return (
    <section
      style={{
        display: 'grid',
        gap: 28,
        padding: 36,
        borderRadius: 32,
        background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 55%, #0f766e 100%)',
        color: '#f8fafc',
        boxShadow: '0 32px 90px rgba(15, 23, 42, 0.22)',
      }}
    >
      <div style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
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
          Workspace
        </span>
        <h1 style={{ margin: 0, fontSize: 48, lineHeight: 1, letterSpacing: '-0.04em' }}>Plataforma de EAD</h1>
        <p style={{ margin: 0, fontSize: 18, lineHeight: 1.7, color: 'rgba(248, 250, 252, 0.82)' }}>
          Ambiente base gerado para evoluir o produto com rapidez, clareza e consistencia entre as
          jornadas principais.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div style={{ padding: 18, borderRadius: 22, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(248,250,252,0.66)' }}>
            Modulos ativos
          </div>
          <strong style={{ display: 'block', marginTop: 10, fontSize: 28 }}>{productAreas.length}</strong>
        </div>
        <div style={{ padding: 18, borderRadius: 22, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(248,250,252,0.66)' }}>
            Navegacao pronta
          </div>
          <strong style={{ display: 'block', marginTop: 10, fontSize: 28 }}>100%</strong>
        </div>
        <div style={{ padding: 18, borderRadius: 22, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(248,250,252,0.66)' }}>
            Base pronta
          </div>
          <strong style={{ display: 'block', marginTop: 10, fontSize: 28 }}>Web + API</strong>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        {productAreas.map((route) => (
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

export default function App() {
  const currentPath = window.location.pathname
  const activeRoute = routes.find((route) => route.path === currentPath) || routes[0]

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '24px 24px 48px',
        background:
          'radial-gradient(circle at top left, rgba(15, 118, 110, 0.08), transparent 28%), linear-gradient(180deg, #f8fafc 0%, #eef4f7 100%)',
        color: '#0f172a',
        fontFamily: 'Inter, Segoe UI, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1220, margin: '0 auto', display: 'grid', gap: 24 }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            padding: '16px 18px',
            borderRadius: 24,
            background: 'rgba(255,255,255,0.82)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.06)',
            backdropFilter: 'blur(14px)',
            position: 'sticky',
            top: 16,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
              Application Studio
            </span>
            <strong style={{ fontSize: 22 }}>Plataforma de EAD</strong>
          </div>

          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' }}>
            {routes.map((route) => {
              const active = activeRoute.path === route.path
              return (
                <a
                  key={route.path}
                  href={route.path}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 999,
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: 14,
                    color: active ? '#f8fafc' : '#334155',
                    background: active ? 'linear-gradient(135deg, #0f766e, #14b8a6)' : '#f8fafc',
                    border: active ? 'none' : '1px solid #e2e8f0',
                    boxShadow: active ? '0 14px 30px rgba(20, 184, 166, 0.24)' : 'none',
                  }}
                >
                  {route.label}
                </a>
              )
            })}
          </nav>
        </header>

        {activeRoute.render()}
      </div>
    </main>
  )
}
