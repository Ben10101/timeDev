import { AppFrame, AppHeader, MetricRow, SidebarNav, StudioHome, SurfaceCard } from '../../../packages/ui/src/index.tsx'

const routes = [
  { path: '/', label: 'InÃ­cio', render: () => <HomePage /> },
  // AUTO_REGISTER_WEB_ROUTES
]

function HomePage() {
  const productAreas = routes.filter((route) => route.path !== '/')

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <StudioHome title="__PROJECT_NAME__" routes={productAreas} />
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1.12fr) minmax(320px, 0.88fr)' }}>
        <SurfaceCard
          title="Resumo do workspace"
          description="Acompanhe a base gerada, as Ã¡reas prontas para evoluÃ§Ã£o e a prÃ³xima frente operacional do produto."
          meta={`${productAreas.length} mÃ³dulo(s)`}
        >
          <MetricRow
            items={[
              { label: 'MÃ³dulos ativos', value: String(productAreas.length) },
              { label: 'Interface', value: 'Profissional' },
              { label: 'Base', value: 'Web + API' },
            ]}
          />
        </SurfaceCard>
        <SurfaceCard
          title="Fila de evoluÃ§Ã£o"
          description="Escolha um mÃ³dulo para continuar a implementaÃ§Ã£o incremental com contratos, backend e experiÃªncia conectados."
          meta="Fluxo guiado"
        >
          <div style={{ display: 'grid', gap: 12 }}>
            {productAreas.map((route) => (
              <a
                key={route.path}
                href={route.path}
                style={{
                  padding: '16px 18px',
                  borderRadius: 18,
                  border: '1px solid #dbe4ee',
                  background: '#f8fafc',
                  textDecoration: 'none',
                  color: '#0f172a',
                  fontWeight: 700,
                }}
              >
                {route.label}
              </a>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </div>
  )
}

export default function App() {
  const currentPath = window.location.pathname
  const activeRoute = routes.find((route) => route.path === currentPath) || routes[0]

  return (
    <AppFrame>
      <AppHeader title={activeRoute.label} routes={routes.map(({ path, label }) => ({ path, label }))} activePath={activeRoute.path} />
      <div style={{ display: 'grid', gridTemplateColumns: '234px minmax(0, 1fr)' }}>
        <SidebarNav routes={routes.map(({ path, label }) => ({ path, label }))} activePath={activeRoute.path} />
        <div style={{ padding: 18 }}>
          {activeRoute.render()}
        </div>
      </div>
    </AppFrame>
  )
}
