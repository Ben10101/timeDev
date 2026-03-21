import { AppFrame, AppHeader, StudioHome } from '../../../packages/ui/src/index.tsx'

const routes = [
  { path: '/', label: 'Inicio', render: () => <HomePage /> },
  // AUTO_REGISTER_WEB_ROUTES
]

function HomePage() {
  const productAreas = routes.filter((route) => route.path !== '/')
  return <StudioHome title="__PROJECT_NAME__" routes={productAreas} />
}

export default function App() {
  const currentPath = window.location.pathname
  const activeRoute = routes.find((route) => route.path === currentPath) || routes[0]

  return (
    <AppFrame>
      <AppHeader title="__PROJECT_NAME__" routes={routes.map(({ path, label }) => ({ path, label }))} activePath={activeRoute.path} />
      {activeRoute.render()}
    </AppFrame>
  )
}
