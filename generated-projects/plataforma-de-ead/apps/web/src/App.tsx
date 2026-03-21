import { ProfileSettingsPage } from './features/profile-settings/index'
import { CourseCatalogPage } from './features/course-catalog/index'
import { CourseModulesPage } from './features/course-modules/index'
import { CourseLessonsPage } from './features/course-lessons/index'
import { LessonMaterialsPage } from './features/lesson-materials/index'
import { AppFrame, AppHeader, StudioHome } from '../../../packages/ui/src/index.tsx'

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
  return <StudioHome title="Plataforma de EAD" routes={productAreas} />
}

export default function App() {
  const currentPath = window.location.pathname
  const activeRoute = routes.find((route) => route.path === currentPath) || routes[0]

  return (
    <AppFrame>
      <AppHeader title="Plataforma de EAD" routes={routes.map(({ path, label }) => ({ path, label }))} activePath={activeRoute.path} />
      {activeRoute.render()}
    </AppFrame>
  )
}
