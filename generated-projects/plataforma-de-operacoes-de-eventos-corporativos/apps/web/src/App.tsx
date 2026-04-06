import { Suspense, lazy } from 'react'
import { AppFrame, AppHeader, MetricRow, SidebarNav, StudioHome, SurfaceCard } from '../../../packages/ui/src/index.tsx'
const EventSchedulesPage = lazy(() => import('./features/event-schedules/index').then((module) => ({ default: module.EventSchedulesPage })))
const EventSuppliersPage = lazy(() => import('./features/event-suppliers/index').then((module) => ({ default: module.EventSuppliersPage })))
const routes = [
 { path: '/', label: 'Inicio', render: () => <HomePage /> },
 { path: '/operations/schedules', label: 'Cronograma', render: () => <EventSchedulesPage /> },
 { path: '/operations/suppliers', label: 'Fornecedores', render: () => <EventSuppliersPage /> },
]
function HomePage() {
 const productAreas = routes.filter((route) => route.path !== '/')
 return (
 <div style={{ display: 'grid', gap: 20 }}>
 <StudioHome title="Plataforma de Operacoes de Eventos Corporativos" routes={productAreas} />
 <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1.12fr) minmax(320px, 0.88fr)' }}>
 <SurfaceCard
 title="Resumo do workspace"
 description="Produto gerado a partir de um blueprint generico, pronto para receber modulos e linguagem de dominio."
 meta={`${productAreas.length} modulo(s)`}
 >
 <MetricRow
 items={[
 { label: 'Modulos ativos', value: String(productAreas.length) },
 { label: 'Tom visual', value: 'profissional' },
 { label: 'Navegacao', value: 'generic-suite' },
 ]}
 />
 </SurfaceCard>
 <SurfaceCard
 title="Fila de evolucao"
 description="Blueprint inicial prioriza cadastro principal, acompanhamento operacional."
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