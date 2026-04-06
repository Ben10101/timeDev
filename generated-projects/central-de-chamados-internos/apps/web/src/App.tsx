import { Suspense, lazy } from 'react'
import { AppFrame, AppHeader, MetricRow, SidebarNav, StudioHome, SurfaceCard } from '../../../packages/ui/src/index.tsx'

const SupportTicketAttachmentsPage = lazy(() =>
  import('./features/support-ticket-attachments/index').then((module) => ({ default: module.SupportTicketAttachmentsPage }))
)
const AccessControlRolesPage = lazy(() =>
  import('./features/access-control-roles/index').then((module) => ({ default: module.AccessControlRolesPage }))
)
const TicketNotificationPreferencesPage = lazy(() =>
  import('./features/ticket-notification-preferences/index').then((module) => ({ default: module.TicketNotificationPreferencesPage }))
)
const SupportPerformanceDashboardPage = lazy(() =>
  import('./features/support-performance-dashboard/index').then((module) => ({ default: module.SupportPerformanceDashboardPage }))
)
const TicketEscalationQueuePage = lazy(() =>
  import('./features/ticket-escalation-queue/index').then((module) => ({ default: module.TicketEscalationQueuePage }))
)

const routes = [
  { path: '/', label: 'Inicio', render: () => <HomePage /> },
  { path: '/analytics/support-performance', label: 'Performance do Suporte', render: () => <SupportPerformanceDashboardPage /> },
  { path: '/tickets/escalations', label: 'Escalonamentos', render: () => <TicketEscalationQueuePage /> },
  { path: '/tickets/attachments', label: 'Comprovantes', render: () => <SupportTicketAttachmentsPage /> },
  { path: '/settings/access-control', label: 'Perfis de Acesso', render: () => <AccessControlRolesPage /> },
  { path: '/settings/notifications', label: 'Notificacoes', render: () => <TicketNotificationPreferencesPage /> },
]

function HomePage() {
  const productAreas = routes.filter((route) => route.path !== '/')

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <StudioHome title="Central de Chamados Internos" routes={productAreas} />
      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1.12fr) minmax(320px, 0.88fr)' }}>
        <SurfaceCard
          title="Resumo do workspace"
          description="Produto para operacao interna que precisa reduzir fila, melhorar SLA e dar visibilidade para lideranca sem virar um CRUD generico."
          meta={`${productAreas.length} modulo(s)`}
        >
          <MetricRow
            items={[
              { label: 'Modulos ativos', value: String(productAreas.length) },
              { label: 'Tom visual', value: 'operacional' },
              { label: 'Navegacao', value: 'operational-workspace' },
            ]}
          />
        </SurfaceCard>
        <SurfaceCard
          title="Fila de evolucao"
          description="Blueprint inicial prioriza abertura e acompanhamento de chamados, escalonamentos criticos, anexos e evidencias por caso."
          meta="Blueprint guiado"
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

function RouteLoadingFallback() {
  return (
    <SurfaceCard
      title="Preparando modulo"
      description="Carregando a tela regenerada para manter o shell leve e abrir cada jornada sob demanda."
      meta="Lazy loading ativo"
    >
      <div style={{ display: 'grid', gap: 10 }}>
        <div style={{ height: 12, borderRadius: 999, background: '#dbe4ee' }} />
        <div style={{ height: 12, width: '72%', borderRadius: 999, background: '#e7edf5' }} />
      </div>
    </SurfaceCard>
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
          <Suspense fallback={<RouteLoadingFallback />}>
            {activeRoute.render()}
          </Suspense>
        </div>
      </div>
    </AppFrame>
  )
}
