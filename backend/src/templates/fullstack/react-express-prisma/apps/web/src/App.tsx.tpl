const routes = [
  { path: '/', label: 'Home', render: () => <p>Frontend base gerado pela AI Software Factory.</p> },
  // AUTO_REGISTER_WEB_ROUTES
]

export default function App() {
  const currentPath = window.location.pathname
  const activeRoute = routes.find((route) => route.path === currentPath) || routes[0]

  return (
    <main style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>__PROJECT_NAME__</h1>
      <nav style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {routes.map((route) => (
          <a key={route.path} href={route.path}>{route.label}</a>
        ))}
      </nav>
      {activeRoute.render()}
    </main>
  )
}
