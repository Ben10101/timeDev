import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ResultsPage from './pages/ResultsPage'
import PipelinePage from './pages/PipelinePage'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/results/:projectId" element={<ResultsPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
