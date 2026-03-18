import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PipelinePage from './pages/PipelinePage';
import ProjectOverviewPage from './pages/ProjectOverviewPage';
import ProjectsPage from './pages/ProjectsPage';
import ResultsPage from './pages/ResultsPage';
import TaskDetailsPage from './pages/TaskDetailsPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectUuid" element={<ProjectOverviewPage />} />
          <Route path="/projects/:projectUuid/tasks/:taskUuid" element={<TaskDetailsPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/results/:projectId" element={<ResultsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
