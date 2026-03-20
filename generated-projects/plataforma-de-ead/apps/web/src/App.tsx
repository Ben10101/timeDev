import { ProfileSettingsPage } from './features/profile-settings/index'

const routes = [
  { path: '/', label: 'Home', render: () => <p>Bem-vindo ao Plataforma de EAD.</p> },
  { path: '/profile', label: 'Perfil', render: () => <ProfileSettingsPage /> },
]

export default function App() {
  const currentPath = window.location.pathname
  const activeRoute = routes.find((route) => route.path === currentPath) || routes[0]

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Plataforma de EAD</h1>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {routes.map((route) => (
          <a key={route.path} href={route.path}>{route.label}</a>
        ))}
      </nav>
      {activeRoute.render()}
    </main>
  )
}
