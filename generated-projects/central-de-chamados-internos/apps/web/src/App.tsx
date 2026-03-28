import { AppFrame, AppHeader, MetricRow, SidebarNav, StudioHome, SurfaceCard } from '../../../packages/ui/src/index.tsx'
import { ProfileSettingsPage } from './features/profile-settings/index'
import { AccessControlRolesPage } from './features/access-control-roles/index'
import { TicketNotificationPreferencesPage } from './features/ticket-notification-preferences/index'
import { SupportTicketAttachmentsPage } from './features/support-ticket-attachments/index'
const routes = [
 { path: '/', label: 'Inicio', render: () => <HomePage /> },
 { path: '/profile', label: 'Perfil', render: () => <ProfileSettingsPage /> },
 { path: '/settings/access-control', label: 'Controle de Acesso', render: () => <AccessControlRolesPage /> },
 { path: '/settings/notifications', label: 'Notificacoes', render: () => <TicketNotificationPreferencesPage /> },
 { path: '/tickets/attachments', label: 'Anexos', render: () => <SupportTicketAttachmentsPage /> },
]
function HomePage() {
 const productAreas = routes.filter((route) => route.path !== '/')
 return (
 <div style={{ display: 'grid', gap: 20 }}>
 <StudioHome title="Central de Chamados Internos" routes={productAreas} />
 <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'minmax(0, 1.12fr) minmax(320px, 0.88fr)' }}>
 <SurfaceCard
 title="Resumo do workspace"
 description="Acompanhe a base gerada, as areas prontas para evolucao e a proxima frente operacional do produto."
 meta={`${productAreas.length} modulo(s)`}
 >
 <MetricRow
 items={[
 { label: 'Modulos ativos', value: String(productAreas.length) },
 { label: 'Interface', value: 'Profissional' },
 { label: 'Base', value: 'Web + API' },
 ]}
 />
 </SurfaceCard>
 <SurfaceCard
 title="Fila de evolucao"
 description="Escolha um modulo para continuar a implementacao incremental com contratos, backend e experiencia conectados."
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