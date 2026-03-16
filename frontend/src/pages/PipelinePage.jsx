import { useLocation, Navigate } from 'react-router-dom';
import PipelineExecutor from '../components/PipelineExecutor';

export default function PipelinePage() {
  const location = useLocation();
  const idea = location.state?.idea;
  const answers = location.state?.answers;

  if (!idea) {
    // Se não houver ideia, redireciona para a página inicial
    return <Navigate to="/" />;
  }

  return <PipelineExecutor idea={idea} answers={answers} />;
}