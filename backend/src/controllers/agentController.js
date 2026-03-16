import { runSingleAgent } from '../services/orchestratorService.js';
import { v4 as uuidv4 } from 'uuid';

export async function runAgentController(req, res) {
  try {
    const { agent, payload } = req.body;

    if (!agent || !payload || !payload.idea) {
      return res.status(400).json({ message: 'Nome do agente e payload com a ideia são obrigatórios.' });
    }
    
    // Garante que um project_id exista para a sessão de geração
    if (!payload.project_id) {
        payload.project_id = uuidv4();
    }

    const result = await runSingleAgent(agent, payload);
    
    res.status(200).json({
      success: true,
      project_id: payload.project_id,
      data: result
    });

  } catch (error) {
    console.error(`[AgentController] Error: ${error.message}`);
    res.status(500).json({ message: 'Erro ao executar o agente de IA', error: error.message });
  }
}