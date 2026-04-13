import { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const ProjectOverviewPage = lazy(() => import('./pages/ProjectOverviewPage'));
const ProjectPlanningPage = lazy(() => import('./pages/ProjectPlanningPage'));
const ProjectTeamPage = lazy(() => import('./pages/ProjectTeamPage'));
const PipelinePage = lazy(() => import('./pages/PipelinePage'));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'));
const WorkspaceTeamPage = lazy(() => import('./pages/WorkspaceTeamPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const TaskDetailsPage = lazy(() => import('./pages/TaskDetailsPage'));
const BacklogKanban = lazy(() => import('./pages/BacklogKanban'));
const GlobalBacklogPage = lazy(() => import('./pages/GlobalBacklogPage'));
const AiSettingsPage = lazy(() => import('./pages/AiSettingsPage'));
const CodeStudioPage = lazy(() => import('./pages/CodeStudioPage'));
const GovernancePage = lazy(() => import('./pages/GovernancePage'));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(26,94,74,0.12),_transparent_28%),linear-gradient(180deg,_#f4f1e8_0%,_#edf2ea_52%,_#e6ece5_100%)] px-6">
      <div className="rounded-[28px] border border-slate-200 bg-white/90 px-6 py-5 text-center shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8aac55]">Carregando</p>
        <p className="mt-2 text-sm text-slate-600">Preparando a proxima superficie da plataforma...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Suspense fallback={<RouteLoadingFallback />}>
        <div className="min-h-screen">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Navigate to="/projects" replace />
                </ProtectedRoute>
              }
            />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/auth/register" element={<AuthPage />} />
            <Route
              path="/workspace"
              element={
                <ProtectedRoute>
                  <WorkspacePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/workspace/team"
              element={
                <ProtectedRoute>
                  <WorkspaceTeamPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <ProjectsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectUuid"
              element={
                <ProtectedRoute>
                  <ProjectOverviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectUuid/planning"
              element={
                <ProtectedRoute>
                  <ProjectPlanningPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectUuid/team"
              element={
                <ProtectedRoute>
                  <ProjectTeamPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectUuid/pipeline"
              element={
                <ProtectedRoute>
                  <PipelinePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects/:projectUuid/tasks/:taskUuid"
              element={
                <ProtectedRoute>
                  <TaskDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/code-studio"
              element={
                <ProtectedRoute>
                  <CodeStudioPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/results/:projectId"
              element={
                <ProtectedRoute>
                  <ResultsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/backlog"
              element={
                <ProtectedRoute>
                  <BacklogKanban />
                </ProtectedRoute>
              }
            />
            <Route
              path="/global-backlog"
              element={
                <ProtectedRoute>
                  <GlobalBacklogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/ai"
              element={
                <ProtectedRoute>
                  <AiSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/governance"
              element={
                <ProtectedRoute>
                  <GovernancePage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </Suspense>
    </Router>
  );
}

export default App;
