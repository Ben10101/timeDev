import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AuthPage from './pages/AuthPage';
import HomePage from './pages/HomePage';
import PipelinePage from './pages/PipelinePage';
import ProjectOverviewPage from './pages/ProjectOverviewPage';
import ProjectsPage from './pages/ProjectsPage';
import ResultsPage from './pages/ResultsPage';
import TaskDetailsPage from './pages/TaskDetailsPage';
import BacklogKanban from './pages/BacklogKanban';
import GlobalBacklogPage from './pages/GlobalBacklogPage';
import AiSettingsPage from './pages/AiSettingsPage';
import CodeStudioPage from './pages/CodeStudioPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route path="/auth" element={<AuthPage />} />
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
            path="/projects/:projectUuid/tasks/:taskUuid"
            element={
              <ProtectedRoute>
                <TaskDetailsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pipeline"
            element={
              <ProtectedRoute>
                <PipelinePage />
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;
