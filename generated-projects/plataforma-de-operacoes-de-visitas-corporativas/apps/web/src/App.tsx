import { Suspense, lazy } from 'react'
import { AppFrame, AppHeader, SidebarNav, SurfaceCard } from '../../../packages/ui/src/index.tsx'
const VisitExtraCompanionsPage = lazy(() => import('./features/visit-extra-companions/index').then((module) => ({ default: module.VisitExtraCompanionsPage })))
const EventSchedulesPage = lazy(() => import('./features/event-schedules/index').then((module) => ({ default: module.EventSchedulesPage })))
const VisitRecurringHistoryPage = lazy(() => import('./features/visit-recurring-history/index').then((module) => ({ default: module.VisitRecurringHistoryPage })))
const VisitOperationalResponsiblesPage = lazy(() => import('./features/visit-operational-responsibles/index').then((module) => ({ default: module.VisitOperationalResponsiblesPage })))
const routes = [
 { path: '/operations/extra-companions', label: 'Acompanhantes extras', render: () => <VisitExtraCompanionsPage /> },
 { path: '/operations/schedules', label: 'Cronograma', render: () => <EventSchedulesPage /> },
 { path: '/operations/visit-history', label: 'Historico de visitas', render: () => <VisitRecurringHistoryPage /> },
 { path: '/operations/responsibles', label: 'Responsaveis', render: () => <VisitOperationalResponsiblesPage /> },
]
function RouteLoadingFallback() {
 return (
 <SurfaceCard
 title="Preparando modulo"
 description="Carregando a experiencia dessa area com navegacao progressiva para manter o shell mais leve."
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
 const defaultRoute = routes[0]
 const activeRoute = routes.find((route) => route.path === currentPath) || defaultRoute
 if (currentPath === '/' && defaultRoute && window.location.pathname !== defaultRoute.path) {
 window.history.replaceState({}, '', defaultRoute.path)
 }
 return (
 <AppFrame>
 <AppHeader title={activeRoute?.label || 'Plataforma de Operacoes de Visitas Corporativas'} routes={routes.map(({ path, label }) => ({ path, label }))} activePath={activeRoute?.path || ''} />
 <div style={{ display: 'grid', gridTemplateColumns: '234px minmax(0, 1fr)' }}>
 <SidebarNav routes={routes.map(({ path, label }) => ({ path, label }))} activePath={activeRoute?.path || ''} />
 <div style={{ padding: 18 }}>
 <Suspense fallback={<RouteLoadingFallback />}>
 {activeRoute ? activeRoute.render() : null}
 </Suspense>
 </div>
 </div>
 </AppFrame>
 )
}