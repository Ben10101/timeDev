import { v4 as uuidv4 } from 'uuid'
import { orchestrateProject } from '../services/orchestratorService.js'

export async function generateProjectController(req, res) {
  try {
    const { idea } = req.body

    if (!idea || idea.trim() === '') {
      return res.status(400).json({ message: 'Ideia do projeto é obrigatória' })
    }

    // Gera ID único para o projeto
    const projectId = uuidv4()

    console.log(`📦 Gerando projeto: ${projectId}`)
    console.log(`📝 Ideia: ${idea}`)

    // Chama o orchestrator para processar a ideia
    const result = await orchestrateProject(projectId, idea)

    return res.status(200).json({
      projectId,
      timestamp: new Date(),
      ...result
    })
  } catch (error) {
    console.error('❌ Erro na geração do projeto:', error)
    return res.status(500).json({
      message: 'Erro ao gerar projeto',
      error: error.message
    })
  }
}

export default {
  generateProjectController
}
