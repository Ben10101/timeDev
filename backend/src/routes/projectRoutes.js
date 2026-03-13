import express from 'express'
import { generateProjectController } from '../controllers/projectController.js'
// import { downloadProjectController } from '../controllers/downloadController.js'

const router = express.Router()

router.post('/generate-project', generateProjectController)
// router.get('/download-project/:projectId', downloadProjectController)

// Rota temporária com informações sobre o projeto gerado
router.get('/project-info/:projectId', (req, res) => {
  const { projectId } = req.params
  const projectPath = `outputs/generated_projects/${projectId}`
  
  res.json({
    message: 'Projeto gerado com sucesso!',
    projectId,
    location: projectPath,
    instructions: `
      Os arquivos do seu projeto estão em: ${projectPath}
      
      Para rodar:
      1. cd ${projectPath}/backend && npm install && npm start
      2. cd ${projectPath}/frontend && npm install && npm run dev
    `
  })
})

export default router
